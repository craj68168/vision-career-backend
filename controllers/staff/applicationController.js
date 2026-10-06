const Application = require("../../models/applications/applicationSchema");

const Vacancy = require("../../models/providers/vacancySchema");

const {
  sendApplicationResume,
} = require("../../utils/applicationResumeStorage");

// ======================================================
// SAFE APPLICATION SERIALIZER
// ======================================================

const serializeApplication = (application, vacancy) => ({
  applicationId: application.application_id,

  vacancyId: application.vacancy_id,

  providerId: application.provider_id,

  status: application.status,

  coverLetter: application.cover_letter || null,

  appliedAt: application.applied_at,

  createdAt: application.created_at,

  updatedAt: application.updated_at,

  // ====================================================
  // STAFF SCREENING
  // ====================================================

  screening: {
    status: application.staff_screening_status || "NOT_SCREENED",

    note: application.staff_screening_note || null,

    screenedByStaffId: application.screened_by_staff_id || null,

    screenedAt: application.screened_at || null,
  },

  // ====================================================
  // APPLICATION REVIEW
  //
  // Existing application schema fields are reused.
  //
  // adminReviewedBy may contain:
  //
  // ADM-... when Admin made the decision
  // STF-... when authorized Staff made the decision
  //
  // This avoids changing the existing application
  // workflow/schema at this stage.
  // ====================================================

  review: {
    reviewedAt: application.admin_reviewed_at || null,

    reviewedBy: application.admin_reviewed_by || null,

    rejectionReason: application.admin_rejection_reason || null,
  },

  // ====================================================
  // PROFESSIONAL CANDIDATE SNAPSHOT ONLY
  //
  // No email
  // No phone
  // No address
  // No profile photo
  // No private documents
  // ====================================================

  applicant: {
    name: application.profile_snapshot?.name || null,

    nationality: application.profile_snapshot?.nationality || null,

    visaType: application.profile_snapshot?.visa_type || null,

    visaExpiryDate: application.profile_snapshot?.visa_expiry_date || null,

    japaneseLevel: application.profile_snapshot?.japanese_level || null,

    skills: application.profile_snapshot?.skills || [],

    desiredJob: application.profile_snapshot?.desired_job || null,

    desiredLocation: application.profile_snapshot?.desired_location || null,

    education: application.profile_snapshot?.education || [],

    employmentHistory: application.profile_snapshot?.employment_history || [],

    resumeAvailable: Boolean(
      application.profile_snapshot?.generated_resume_file,
    ),
  },

  vacancy: vacancy
    ? {
        vacancyId: vacancy.vacancyId,

        title: vacancy.title,

        companyName: vacancy.companyName,

        employmentType: vacancy.employmentType,

        numberOfPeople: vacancy.numberOfPeople,

        workLocation: vacancy.workLocation,

        japaneseLevel: vacancy.japaneseLevel,

        status: vacancy.status,
      }
    : null,
});

// ======================================================
// LOAD VACANCIES
// ======================================================

const loadVacancyMap = async (applications) => {
  const vacancyIds = [
    ...new Set(
      applications.map((application) => application.vacancy_id).filter(Boolean),
    ),
  ];

  if (vacancyIds.length === 0) {
    return new Map();
  }

  const vacancies = await Vacancy.find({
    vacancyId: {
      $in: vacancyIds,
    },
  })
    .select(
      [
        "vacancyId",
        "title",
        "companyName",
        "employmentType",
        "numberOfPeople",
        "workLocation",
        "japaneseLevel",
        "status",
      ].join(" "),
    )
    .lean();

  return new Map(vacancies.map((vacancy) => [vacancy.vacancyId, vacancy]));
};

// ======================================================
// LOAD ONE VACANCY SUMMARY
// ======================================================

const loadVacancySummary = async (vacancyId) => {
  if (!vacancyId) {
    return null;
  }

  return Vacancy.findOne({
    vacancyId,
  })
    .select(
      [
        "vacancyId",
        "title",
        "companyName",
        "employmentType",
        "numberOfPeople",
        "workLocation",
        "japaneseLevel",
        "status",
      ].join(" "),
    )
    .lean();
};

// ======================================================
// GET STAFF APPLICATIONS
//
// GET /api/staff/applications
// ======================================================

// ======================================================
// GET STAFF APPLICATIONS
//
// GET /api/staff/applications
// ======================================================

exports.getApplications = async (req, res) => {
  try {
    const applications = await Application.find()
      .sort({
        applied_at: -1,
      })
      .lean();

    const vacancyMap = await loadVacancyMap(applications);

    const data = applications.map((application) =>
      serializeApplication(
        application,

        vacancyMap.get(application.vacancy_id),
      ),
    );

    return res.status(200).json({
      success: true,

      count: data.length,

      summary: {
        // ==================================================
        // TOTAL
        // ==================================================

        total: data.length,

        // ==================================================
        // PENDING APPLICATION DECISIONS
        //
        // This counts only applications still waiting for
        // an approval/rejection decision.
        // ==================================================

        pendingAdminApproval: data.filter(
          (item) => item.status === "PENDING_ADMIN_APPROVAL",
        ).length,

        // ==================================================
        // SCREENING COUNTS
        //
        // IMPORTANT:
        //
        // Screening status is counted independently from
        // the final application status.
        //
        // Example:
        //
        // SCREENED + SENT_TO_PROVIDER
        // still belongs in the Screened summary.
        //
        // NEEDS_ATTENTION + ADMIN_REJECTED
        // still belongs in Needs Attention.
        // ==================================================

        notScreened: data.filter(
          (item) => item.screening.status === "NOT_SCREENED",
        ).length,

        screened: data.filter((item) => item.screening.status === "SCREENED")
          .length,

        needsAttention: data.filter(
          (item) => item.screening.status === "NEEDS_ATTENTION",
        ).length,
      },

      data,
    });
  } catch (error) {
    console.error("GET STAFF APPLICATIONS ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load applications.",
    });
  }
};

// ======================================================
// GET ONE APPLICATION
//
// GET /api/staff/applications/:applicationId
// ======================================================

exports.getApplicationById = async (req, res) => {
  try {
    const application = await Application.findOne({
      application_id: req.params.applicationId,
    }).lean();

    if (!application) {
      return res.status(404).json({
        success: false,

        message: "Application not found.",
      });
    }

    const vacancy = await loadVacancySummary(application.vacancy_id);

    return res.status(200).json({
      success: true,

      data: serializeApplication(application, vacancy),
    });
  } catch (error) {
    console.error("GET STAFF APPLICATION ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load application.",
    });
  }
};

// ======================================================
// GET APPLICATION FROZEN RESUME
//
// GET /api/staff/applications/:applicationId/resume
//
// Requires:
// applications:view
// ======================================================

exports.getStaffApplicationResume = async (req, res) => {
  try {
    const application = await Application.findOne({
      application_id: req.params.applicationId,
    }).lean();

    if (!application) {
      return res.status(404).json({
        success: false,

        message: "Application not found.",
      });
    }

    const storedResume = application.profile_snapshot?.generated_resume_file;

    if (!storedResume) {
      return res.status(404).json({
        success: false,

        message: "Application resume is not available.",
      });
    }

    await sendApplicationResume({
      res,

      storedPath: storedResume,

      applicationId: application.application_id,
    });

    return undefined;
  } catch (error) {
    console.error("GET STAFF APPLICATION RESUME ERROR:", error);

    if (res.headersSent) {
      return undefined;
    }

    const statusCode =
      error.statusCode || error.$metadata?.httpStatusCode || 500;

    return res.status(statusCode).json({
      success: false,

      message:
        statusCode === 404
          ? "Application resume file not found."
          : statusCode === 403
            ? "Application resume access denied."
            : "Failed to load application resume.",
    });
  }
};

// ======================================================
// SCREEN APPLICATION
//
// PATCH /api/staff/applications/:applicationId/screen
//
// Permission:
// applications:review
//
// IMPORTANT:
//
// Screening and final approval are separate actions.
//
// Screening does NOT change application.status.
// ======================================================

exports.screenApplication = async (req, res) => {
  try {
    const { screeningStatus, note } = req.body;

    // ==================================================
    // STATUS VALIDATION
    // ==================================================

    if (!["SCREENED", "NEEDS_ATTENTION"].includes(screeningStatus)) {
      return res.status(400).json({
        success: false,

        message: "Invalid screening status.",
      });
    }

    const normalizedNote = String(note || "").trim();

    // ==================================================
    // NEEDS ATTENTION REQUIRES NOTE
    // ==================================================

    if (screeningStatus === "NEEDS_ATTENTION" && !normalizedNote) {
      return res.status(400).json({
        success: false,

        message:
          "A note is required when marking an application as needing attention.",
      });
    }

    if (normalizedNote.length > 2000) {
      return res.status(400).json({
        success: false,

        message: "Screening note cannot exceed 2000 characters.",
      });
    }

    // ==================================================
    // FIND APPLICATION
    // ==================================================

    const application = await Application.findOne({
      application_id: req.params.applicationId,
    });

    if (!application) {
      return res.status(404).json({
        success: false,

        message: "Application not found.",
      });
    }

    // ==================================================
    // ONLY PENDING APPLICATIONS CAN BE SCREENED
    // ==================================================

    if (application.status !== "PENDING_ADMIN_APPROVAL") {
      return res.status(409).json({
        success: false,

        message: "Only applications waiting for approval can be screened.",
      });
    }

    // ==================================================
    // SAVE SCREENING
    // ==================================================

    application.staff_screening_status = screeningStatus;

    application.staff_screening_note = normalizedNote || null;

    application.screened_by_staff_id = req.staff.staffId;

    application.screened_at = new Date();

    await application.save();

    const vacancy = await loadVacancySummary(application.vacancy_id);

    return res.status(200).json({
      success: true,

      message:
        screeningStatus === "SCREENED"
          ? "Application screening completed."
          : "Application marked as needing attention.",

      data: serializeApplication(application.toObject(), vacancy),
    });
  } catch (error) {
    console.error("SCREEN STAFF APPLICATION ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to screen application.",
    });
  }
};

// ======================================================
// APPROVE APPLICATION
//
// PATCH /api/staff/applications/:applicationId/approve
//
// Permission:
// applications:approval
//
// Workflow:
//
// PENDING_ADMIN_APPROVAL
//          ↓
// SENT_TO_PROVIDER
//
// IMPORTANT:
//
// Approval does NOT require Staff screening first.
//
// applications:review and applications:approval are
// intentionally independent permissions.
// ======================================================

exports.approveStaffApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;

    // ==================================================
    // FIND APPLICATION
    // ==================================================

    const application = await Application.findOne({
      application_id: applicationId,
    });

    if (!application) {
      return res.status(404).json({
        success: false,

        message: "Application not found.",
      });
    }

    // ==================================================
    // STATUS VALIDATION
    // ==================================================

    if (application.status !== "PENDING_ADMIN_APPROVAL") {
      return res.status(409).json({
        success: false,

        message: "Only applications waiting for approval can be approved.",
      });
    }

    // ==================================================
    // APPROVE
    // ==================================================

    application.status = "SENT_TO_PROVIDER";

    application.admin_reviewed_at = new Date();

    application.admin_reviewed_by = req.staff.staffId;

    application.admin_rejection_reason = null;

    await application.save();

    // ==================================================
    // RELATED VACANCY
    // ==================================================

    const vacancy = await loadVacancySummary(application.vacancy_id);

    // ==================================================
    // RESPONSE
    // ==================================================

    return res.status(200).json({
      success: true,

      message: "Application approved and sent to Provider.",

      data: serializeApplication(application.toObject(), vacancy),
    });
  } catch (error) {
    console.error("APPROVE STAFF APPLICATION ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to approve application.",
    });
  }
};

// ======================================================
// REJECT APPLICATION
//
// PATCH /api/staff/applications/:applicationId/reject
//
// Permission:
// applications:approval
//
// BODY:
//
// {
//   "reason": "Reason for rejection"
// }
//
// Workflow:
//
// PENDING_ADMIN_APPROVAL
//          ↓
// ADMIN_REJECTED
//
// We intentionally retain ADMIN_REJECTED because it is
// the existing application workflow status used by the
// Job Seeker side.
//
// The decision may now be performed by an Admin or an
// authorized Staff account.
// ======================================================

exports.rejectStaffApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;

    const normalizedReason = String(req.body?.reason || "").trim();

    // ==================================================
    // REASON VALIDATION
    // ==================================================

    if (!normalizedReason) {
      return res.status(400).json({
        success: false,

        message: "Rejection reason is required.",
      });
    }

    if (normalizedReason.length > 1000) {
      return res.status(400).json({
        success: false,

        message: "Rejection reason cannot exceed 1000 characters.",
      });
    }

    // ==================================================
    // FIND APPLICATION
    // ==================================================

    const application = await Application.findOne({
      application_id: applicationId,
    });

    if (!application) {
      return res.status(404).json({
        success: false,

        message: "Application not found.",
      });
    }

    // ==================================================
    // STATUS VALIDATION
    // ==================================================

    if (application.status !== "PENDING_ADMIN_APPROVAL") {
      return res.status(409).json({
        success: false,

        message: "Only applications waiting for approval can be rejected.",
      });
    }

    // ==================================================
    // REJECT
    // ==================================================

    application.status = "ADMIN_REJECTED";

    application.admin_reviewed_at = new Date();

    application.admin_reviewed_by = req.staff.staffId;

    application.admin_rejection_reason = normalizedReason;

    await application.save();

    // ==================================================
    // RELATED VACANCY
    // ==================================================

    const vacancy = await loadVacancySummary(application.vacancy_id);

    // ==================================================
    // RESPONSE
    // ==================================================

    return res.status(200).json({
      success: true,

      message: "Application rejected successfully.",

      data: serializeApplication(application.toObject(), vacancy),
    });
  } catch (error) {
    console.error("REJECT STAFF APPLICATION ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to reject application.",
    });
  }
};
