const Application = require("../../models/applications/applicationSchema");

const Seeker = require("../../models/seekers/seekerSchema");

const Vacancy = require("../../models/providers/vacancySchema");

const Provider = require("../../models/providers/registerSchema");

const {
  sendApplicationResume,
} = require("../../utils/applicationResumeStorage");

// ======================================================
// APPLICATION STATUSES
// ======================================================

const APPLICATION_STATUSES = [
  "PENDING_ADMIN_APPROVAL",
  "ADMIN_REJECTED",
  "SENT_TO_PROVIDER",
  "UNDER_REVIEW",
  "INTERVIEW",
  "SELECTED",
  "HIRED",
  "REJECTED",
];

// ======================================================
// STAFF SCREENING SERIALIZER
// ======================================================

const serializeStaffScreening = (application) => ({
  status: application.staff_screening_status || "NOT_SCREENED",

  note: application.staff_screening_note || null,

  screenedByStaffId: application.screened_by_staff_id || null,

  screenedAt: application.screened_at || null,
});

// ======================================================
// ADMIN REVIEW SERIALIZER
// ======================================================

const serializeAdminReview = (application) => ({
  reviewedAt: application.admin_reviewed_at || null,

  reviewedBy: application.admin_reviewed_by || null,

  rejectionReason: application.admin_rejection_reason || null,
});

// ======================================================
// FIND RELATED DATA
// ======================================================

const getRelatedData = async (applications) => {
  const seekerIds = [
    ...new Set(
      applications.map((application) => application.seeker_id).filter(Boolean),
    ),
  ];

  const vacancyIds = [
    ...new Set(
      applications.map((application) => application.vacancy_id).filter(Boolean),
    ),
  ];

  const providerIds = [
    ...new Set(
      applications
        .map((application) => application.provider_id)
        .filter(Boolean),
    ),
  ];

  const [seekers, vacancies, providers] = await Promise.all([
    seekerIds.length
      ? Seeker.find({
          seeker_id: {
            $in: seekerIds,
          },
        }).lean()
      : [],

    vacancyIds.length
      ? Vacancy.find({
          vacancyId: {
            $in: vacancyIds,
          },
        }).lean()
      : [],

    providerIds.length
      ? Provider.find({
          registerId: {
            $in: providerIds,
          },
        }).lean()
      : [],
  ]);

  return {
    seekerMap: new Map(seekers.map((seeker) => [seeker.seeker_id, seeker])),

    vacancyMap: new Map(
      vacancies.map((vacancy) => [vacancy.vacancyId, vacancy]),
    ),

    providerMap: new Map(
      providers.map((provider) => [provider.registerId, provider]),
    ),
  };
};

// ======================================================
// LIST SERIALIZER
// ======================================================

const toApplicationListItem = (application, seeker, vacancy, provider) => {
  return {
    applicationId: application.application_id,

    seekerId: application.seeker_id,

    vacancyId: application.vacancy_id,

    providerId: application.provider_id,

    status: application.status,

    appliedAt: application.applied_at,

    coverLetter: application.cover_letter || null,

    candidate: {
      name: seeker?.name || application.profile_snapshot?.name || "Unknown",

      email: seeker?.email || null,

      phone: seeker?.phone || null,

      currentLocation: seeker?.current_location || null,

      nationality:
        seeker?.nationality ||
        application.profile_snapshot?.nationality ||
        null,

      visaType:
        seeker?.visa_type || application.profile_snapshot?.visa_type || null,

      japaneseLevel:
        seeker?.japanese_level ||
        application.profile_snapshot?.japanese_level ||
        null,
    },

    vacancy: {
      vacancyId: vacancy?.vacancyId || application.vacancy_id,

      title: vacancy?.title || "Unknown Vacancy",

      companyName:
        vacancy?.companyName || provider?.companyName || "Unknown Company",

      employmentType: vacancy?.employmentType || null,

      workLocation: vacancy?.workLocation || null,

      salaryMin: vacancy?.salaryMin ?? null,

      salaryMax: vacancy?.salaryMax ?? null,
    },

    provider: {
      registerId: provider?.registerId || application.provider_id,

      name: provider?.name || null,

      companyName: provider?.companyName || vacancy?.companyName || null,

      email: provider?.email || null,
    },

    staffScreening: serializeStaffScreening(application),

    adminReview: serializeAdminReview(application),
  };
};

// ======================================================
// SUMMARY
// ======================================================

const getApplicationSummary = async () => {
  const result = await Application.aggregate([
    {
      $group: {
        _id: "$status",

        count: {
          $sum: 1,
        },
      },
    },
  ]);

  const counts = Object.fromEntries(
    result.map((item) => [item._id, item.count]),
  );

  return {
    total: await Application.countDocuments(),

    pendingAdminApproval: counts.PENDING_ADMIN_APPROVAL || 0,

    sentToProvider: counts.SENT_TO_PROVIDER || 0,

    adminRejected: counts.ADMIN_REJECTED || 0,

    underReview: counts.UNDER_REVIEW || 0,

    interview: counts.INTERVIEW || 0,

    selected: counts.SELECTED || 0,

    hired: counts.HIRED || 0,

    rejected: counts.REJECTED || 0,
  };
};

// ======================================================
// GET ALL ADMIN APPLICATIONS
// ======================================================

exports.getAdminApplications = async (req, res) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : "";

    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim().toLowerCase()
        : "";

    const query = {};

    if (status && APPLICATION_STATUSES.includes(status)) {
      query.status = status;
    }

    const applications = await Application.find(query)
      .sort({
        applied_at: -1,
      })
      .lean();

    const { seekerMap, vacancyMap, providerMap } =
      await getRelatedData(applications);

    let data = applications.map((application) =>
      toApplicationListItem(
        application,

        seekerMap.get(application.seeker_id),

        vacancyMap.get(application.vacancy_id),

        providerMap.get(application.provider_id),
      ),
    );

    if (search) {
      data = data.filter((application) => {
        const searchable = [
          application.applicationId,

          application.candidate.name,

          application.candidate.email,

          application.candidate.phone,

          application.vacancy.title,

          application.vacancy.companyName,

          application.provider.name,

          application.provider.companyName,

          application.status,

          application.staffScreening.status,

          application.staffScreening.screenedByStaffId,

          application.staffScreening.note,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(search);
      });
    }

    const summary = await getApplicationSummary();

    return res.status(200).json({
      success: true,

      count: data.length,

      summary,

      data,
    });
  } catch (error) {
    console.error("GET ADMIN APPLICATIONS ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load applications.",
    });
  }
};

// ======================================================
// GET APPLICATION DETAILS
// ======================================================

exports.getAdminApplicationById = async (req, res) => {
  try {
    const { applicationId } = req.params;

    const application = await Application.findOne({
      application_id: applicationId,
    }).lean();

    if (!application) {
      return res.status(404).json({
        success: false,

        message: "Application not found.",
      });
    }

    const [seeker, vacancy, provider] = await Promise.all([
      Seeker.findOne({
        seeker_id: application.seeker_id,
      }).lean(),

      Vacancy.findOne({
        vacancyId: application.vacancy_id,
      }).lean(),

      Provider.findOne({
        registerId: application.provider_id,
      }).lean(),
    ]);

    return res.status(200).json({
      success: true,

      data: {
        applicationId: application.application_id,

        seekerId: application.seeker_id,

        vacancyId: application.vacancy_id,

        providerId: application.provider_id,

        status: application.status,

        coverLetter: application.cover_letter || null,

        appliedAt: application.applied_at,

        candidate: {
          name: seeker?.name || application.profile_snapshot?.name || "Unknown",

          email: seeker?.email || null,

          phone: seeker?.phone || null,

          address: seeker?.address || null,

          currentLocation: seeker?.current_location || null,

          dateOfBirth: seeker?.date_of_birth || null,

          gender: seeker?.gender || null,

          nationality:
            seeker?.nationality ||
            application.profile_snapshot?.nationality ||
            null,

          visaType:
            seeker?.visa_type ||
            application.profile_snapshot?.visa_type ||
            null,

          visaExpiryDate:
            seeker?.visa_expiry_date ||
            application.profile_snapshot?.visa_expiry_date ||
            null,

          japaneseLevel:
            seeker?.japanese_level ||
            application.profile_snapshot?.japanese_level ||
            null,

          skills: application.profile_snapshot?.skills || seeker?.skills || [],

          desiredJob:
            application.profile_snapshot?.desired_job ||
            seeker?.desired_job ||
            null,

          desiredLocation:
            application.profile_snapshot?.desired_location ||
            seeker?.desired_location ||
            null,

          education:
            application.profile_snapshot?.education || seeker?.education || [],

          employmentHistory:
            application.profile_snapshot?.employment_history ||
            seeker?.employment_history ||
            [],
        },

        vacancy: {
          vacancyId: vacancy?.vacancyId || application.vacancy_id,

          title: vacancy?.title || "Unknown Vacancy",

          companyName:
            vacancy?.companyName || provider?.companyName || "Unknown Company",

          employmentType: vacancy?.employmentType || null,

          numberOfPeople: vacancy?.numberOfPeople || 0,

          jobDescription: vacancy?.jobDescription || null,

          responsibilities: vacancy?.responsibilities || null,

          requiredSkills: vacancy?.requiredSkills || null,

          requiredEducation: vacancy?.requiredEducation || null,

          requiredExperience: vacancy?.requiredExperience || null,

          japaneseLevel: vacancy?.japaneseLevel || null,

          workLocation: vacancy?.workLocation || null,

          remoteWork: vacancy?.remoteWork || null,

          salaryMin: vacancy?.salaryMin ?? null,

          salaryMax: vacancy?.salaryMax ?? null,

          salaryNote: vacancy?.salaryNote || null,
        },

        provider: {
          registerId: provider?.registerId || application.provider_id,

          name: provider?.name || null,

          companyName: provider?.companyName || vacancy?.companyName || null,

          email: provider?.email || null,
        },

        staffScreening: serializeStaffScreening(application),

        adminReview: serializeAdminReview(application),

        // ==================================================
        // IMPORTANT
        //
        // Resume availability comes ONLY from the frozen
        // application snapshot.
        // ==================================================

        resumeAvailable: Boolean(
          application.profile_snapshot?.generated_resume_file,
        ),
      },
    });
  } catch (error) {
    console.error("GET ADMIN APPLICATION DETAILS ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load application details.",
    });
  }
};

// ======================================================
// APPROVE APPLICATION
// ======================================================

exports.approveAdminApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;

    const application = await Application.findOne({
      application_id: applicationId,
    });

    if (!application) {
      return res.status(404).json({
        success: false,

        message: "Application not found.",
      });
    }

    if (application.status !== "PENDING_ADMIN_APPROVAL") {
      return res.status(409).json({
        success: false,

        message: "Only applications pending Admin approval can be approved.",
      });
    }

    application.status = "SENT_TO_PROVIDER";

    application.admin_reviewed_at = new Date();

    application.admin_reviewed_by = req.admin.adminId;

    application.admin_rejection_reason = null;

    await application.save();

    return res.status(200).json({
      success: true,

      message: "Application approved and sent to Provider.",

      data: {
        applicationId: application.application_id,

        status: application.status,

        reviewedAt: application.admin_reviewed_at,

        reviewedBy: application.admin_reviewed_by,

        rejectionReason: null,
      },
    });
  } catch (error) {
    console.error("APPROVE APPLICATION ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to approve application.",
    });
  }
};

// ======================================================
// REJECT APPLICATION
// ======================================================

exports.rejectAdminApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;

    const reason =
      typeof req.body.reason === "string" ? req.body.reason.trim() : "";

    if (!reason) {
      return res.status(400).json({
        success: false,

        message: "Rejection reason is required.",
      });
    }

    if (reason.length > 1000) {
      return res.status(400).json({
        success: false,

        message: "Rejection reason cannot exceed 1000 characters.",
      });
    }

    const application = await Application.findOne({
      application_id: applicationId,
    });

    if (!application) {
      return res.status(404).json({
        success: false,

        message: "Application not found.",
      });
    }

    if (application.status !== "PENDING_ADMIN_APPROVAL") {
      return res.status(409).json({
        success: false,

        message: "Only applications pending Admin approval can be rejected.",
      });
    }

    application.status = "ADMIN_REJECTED";

    application.admin_reviewed_at = new Date();

    application.admin_reviewed_by = req.admin.adminId;

    application.admin_rejection_reason = reason;

    await application.save();

    return res.status(200).json({
      success: true,

      message: "Application rejected.",

      data: {
        applicationId: application.application_id,

        status: application.status,

        reviewedAt: application.admin_reviewed_at,

        reviewedBy: application.admin_reviewed_by,

        rejectionReason: application.admin_rejection_reason,
      },
    });
  } catch (error) {
    console.error("REJECT APPLICATION ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to reject application.",
    });
  }
};

// ======================================================
// GET APPLICATION FROZEN RESUME
//
// GET /api/admin/applications/:applicationId/resume
// ======================================================

exports.getAdminApplicationResume = async (req, res) => {
  try {
    const { applicationId } = req.params;

    const application = await Application.findOne({
      application_id: applicationId,
    }).lean();

    if (!application) {
      return res.status(404).json({
        success: false,

        message: "Application not found.",
      });
    }

    // ==================================================
    // ADMIN MUST SEE THE FROZEN APPLICATION RESUME.
    //
    // Do NOT fall back to:
    //
    // seeker.generated_resume_file
    // seeker.resume_file
    //
    // because those may have changed after application.
    // ==================================================

    const storedResume = application.profile_snapshot?.generated_resume_file;

    if (!storedResume) {
      return res.status(404).json({
        success: false,

        message: "Application resume not found.",
      });
    }

    await sendApplicationResume({
      res,

      storedPath: storedResume,

      applicationId: application.application_id,
    });

    return undefined;
  } catch (error) {
    console.error("GET ADMIN APPLICATION RESUME ERROR:", error);

    if (res.headersSent) {
      return undefined;
    }

    const statusCode =
      error.statusCode || error.$metadata?.httpStatusCode || 500;

    return res.status(statusCode).json({
      success: false,

      message:
        statusCode === 404
          ? "Application resume file does not exist."
          : statusCode === 403
            ? "Application resume access denied."
            : "Failed to load resume.",
    });
  }
};
