const Application = require("../../models/applications/applicationSchema");

const Vacancy = require("../../models/providers/vacancySchema");

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
  // PROFESSIONAL CANDIDATE SNAPSHOT
  //
  // We intentionally do NOT expose:
  //
  // - email
  // - phone
  // - address
  // - profile photo
  // - private documents
  //
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

  // ====================================================
  // VACANCY
  // ====================================================

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
      serializeApplication(application, vacancyMap.get(application.vacancy_id)),
    );

    return res.status(200).json({
      success: true,

      count: data.length,

      summary: {
        total: data.length,

        pendingAdminApproval: data.filter(
          (item) => item.status === "PENDING_ADMIN_APPROVAL",
        ).length,

        notScreened: data.filter(
          (item) =>
            item.status === "PENDING_ADMIN_APPROVAL" &&
            item.screening.status === "NOT_SCREENED",
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

    const vacancy = await Vacancy.findOne({
      vacancyId: application.vacancy_id,
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
// SCREEN APPLICATION
//
// PATCH /api/staff/applications/:applicationId/screen
//
// IMPORTANT:
//
// This does NOT modify application.status.
//
// Staff only records:
// - SCREENED
// - NEEDS_ATTENTION
//
// Admin still performs final approval/rejection.
// ======================================================

exports.screenApplication = async (req, res) => {
  try {
    const { screeningStatus, note } = req.body;

    // ==================================================
    // VALID SCREENING STATUS
    // ==================================================

    if (!["SCREENED", "NEEDS_ATTENTION"].includes(screeningStatus)) {
      return res.status(400).json({
        success: false,

        message: "Invalid screening status.",
      });
    }

    // ==================================================
    // NOTE REQUIRED FOR NEEDS ATTENTION
    // ==================================================

    if (screeningStatus === "NEEDS_ATTENTION" && !String(note || "").trim()) {
      return res.status(400).json({
        success: false,

        message:
          "A note is required when marking an application as needing attention.",
      });
    }

    if (String(note || "").trim().length > 2000) {
      return res.status(400).json({
        success: false,

        message: "Screening note cannot exceed 2000 characters.",
      });
    }

    // ==================================================
    // APPLICATION
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
    // ONLY PENDING ADMIN APPLICATIONS MAY BE SCREENED
    // ==================================================

    if (application.status !== "PENDING_ADMIN_APPROVAL") {
      return res.status(409).json({
        success: false,

        message:
          "Only applications waiting for Admin approval can be screened.",
      });
    }

    // ==================================================
    // SAVE SCREENING RESULT
    // ==================================================

    application.staff_screening_status = screeningStatus;

    application.staff_screening_note = String(note || "").trim() || null;

    application.screened_by_staff_id = req.staff.staffId;

    application.screened_at = new Date();

    await application.save();

    const vacancy = await Vacancy.findOne({
      vacancyId: application.vacancy_id,
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

    return res.status(200).json({
      success: true,

      message:
        screeningStatus === "SCREENED"
          ? "Application screening completed."
          : "Application marked as needing Admin attention.",

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
