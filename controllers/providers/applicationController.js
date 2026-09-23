const Application = require("../../models/applications/applicationSchema");

const Vacancy = require("../../models/providers/vacancySchema");

const {
  sendApplicationResume,
} = require("../../utils/applicationResumeStorage");

// ======================================================
// PROVIDER VISIBLE APPLICATION STATUSES
// ======================================================
//
// Provider must NOT see:
//
// PENDING_ADMIN_APPROVAL
// ADMIN_REJECTED
//
// Only applications approved by Admin are visible.
// ======================================================

const PROVIDER_VISIBLE_STATUSES = [
  "SENT_TO_PROVIDER",
  "UNDER_REVIEW",
  "INTERVIEW",
  "SELECTED",
  "HIRED",
  "REJECTED",
];

// ======================================================
// PROVIDER ALLOWED DECISIONS
// ======================================================

const PROVIDER_UPDATE_STATUSES = [
  "UNDER_REVIEW",
  "INTERVIEW",
  "SELECTED",
  "HIRED",
  "REJECTED",
];

// ======================================================
// SAFE VACANCY SUMMARY
// ======================================================

const toProviderVacancySummary = (vacancy) => {
  if (!vacancy) {
    return null;
  }

  return {
    vacancyId: vacancy.vacancyId,

    title: vacancy.title,

    titleKana: vacancy.titleKana,

    companyName: vacancy.companyName,

    employmentType: vacancy.employmentType,

    numberOfPeople: vacancy.numberOfPeople,

    workLocation: vacancy.workLocation,

    remoteWork: vacancy.remoteWork,

    salaryMin: vacancy.salaryMin,

    salaryMax: vacancy.salaryMax,

    japaneseLevel: vacancy.japaneseLevel,

    status: vacancy.status,
  };
};

// ======================================================
// SAFE PROVIDER APPLICATION RESPONSE
// ======================================================
//
// Provider may see:
//
// Candidate professional snapshot
// Application-specific professional resume
//
// Provider does NOT receive:
//
// seeker_id
// email
// phone
// address
// private documents
// raw Supabase path
// ======================================================

const toProviderApplication = (application, vacancy) => {
  const data = application.toObject ? application.toObject() : application;

  return {
    application_id: data.application_id,

    vacancy_id: data.vacancy_id,

    status: data.status,

    applied_at: data.applied_at,

    created_at: data.created_at,

    updated_at: data.updated_at,

    resume_available: Boolean(data.profile_snapshot?.generated_resume_file),

    applicant: {
      name: data.profile_snapshot?.name || null,

      nationality: data.profile_snapshot?.nationality || null,

      visa_type: data.profile_snapshot?.visa_type || null,

      visa_expiry_date: data.profile_snapshot?.visa_expiry_date || null,

      japanese_level: data.profile_snapshot?.japanese_level || null,

      skills: data.profile_snapshot?.skills || [],

      desired_job: data.profile_snapshot?.desired_job || null,

      desired_location: data.profile_snapshot?.desired_location || null,

      education: data.profile_snapshot?.education || [],

      employment_history: data.profile_snapshot?.employment_history || [],
    },

    vacancy: toProviderVacancySummary(vacancy),
  };
};

// ======================================================
// GET PROVIDER APPLICATIONS
// ======================================================

exports.getProviderApplications = async (req, res) => {
  try {
    const registerId = req.registerId;

    if (!registerId) {
      return res.status(401).json({
        status: "error",

        message: "Provider authentication required.",
      });
    }

    const { status } = req.query;

    const filter = {
      provider_id: registerId,

      status: {
        $in: PROVIDER_VISIBLE_STATUSES,
      },
    };

    if (status) {
      if (!PROVIDER_VISIBLE_STATUSES.includes(status)) {
        return res.status(400).json({
          status: "error",

          message: "Invalid application status.",
        });
      }

      filter.status = status;
    }

    const applications = await Application.find(filter).sort({
      applied_at: -1,
    });

    const vacancyIds = [
      ...new Set(applications.map((application) => application.vacancy_id)),
    ];

    const vacancies =
      vacancyIds.length > 0
        ? await Vacancy.find({
            vacancyId: {
              $in: vacancyIds,
            },

            registerId,
          })
        : [];

    const vacancyMap = new Map(
      vacancies.map((vacancy) => [vacancy.vacancyId, vacancy]),
    );

    const data = applications.map((application) =>
      toProviderApplication(
        application,

        vacancyMap.get(application.vacancy_id),
      ),
    );

    return res.status(200).json({
      status: "success",

      count: data.length,

      data,
    });
  } catch (error) {
    console.error("Get provider applications error:", error);

    return res.status(500).json({
      status: "error",

      message: "Failed to load applications.",
    });
  }
};

// ======================================================
// GET ONE PROVIDER APPLICATION
// ======================================================

exports.getProviderApplicationById = async (req, res) => {
  try {
    const registerId = req.registerId;

    const { applicationId } = req.params;

    if (!registerId) {
      return res.status(401).json({
        status: "error",

        message: "Provider authentication required.",
      });
    }

    const application = await Application.findOne({
      application_id: applicationId,

      provider_id: registerId,

      status: {
        $in: PROVIDER_VISIBLE_STATUSES,
      },
    });

    if (!application) {
      return res.status(404).json({
        status: "error",

        message: "Application not found.",
      });
    }

    const vacancy = await Vacancy.findOne({
      vacancyId: application.vacancy_id,

      registerId,
    });

    return res.status(200).json({
      status: "success",

      data: toProviderApplication(
        application,

        vacancy,
      ),
    });
  } catch (error) {
    console.error("Get provider application error:", error);

    return res.status(500).json({
      status: "error",

      message: "Failed to load application.",
    });
  }
};

// ======================================================
// GET APPLICATION FROZEN RESUME
//
// Provider can only access:
//
// application belonging to this Provider
// application already approved by Admin
// frozen application-specific resume
// ======================================================

exports.getProviderApplicationResume = async (req, res) => {
  try {
    const registerId = req.registerId;

    const { applicationId } = req.params;

    if (!registerId) {
      return res.status(401).json({
        status: "error",

        message: "Provider authentication required.",
      });
    }

    const application = await Application.findOne({
      application_id: applicationId,

      provider_id: registerId,

      status: {
        $in: PROVIDER_VISIBLE_STATUSES,
      },
    }).lean();

    if (!application) {
      return res.status(404).json({
        status: "error",

        message: "Application not found.",
      });
    }

    const storedResume = application.profile_snapshot?.generated_resume_file;

    if (!storedResume) {
      return res.status(404).json({
        status: "error",

        message: "Resume is not available.",
      });
    }

    await sendApplicationResume({
      res,

      storedPath: storedResume,

      applicationId: application.application_id,
    });

    return undefined;
  } catch (error) {
    console.error("Provider resume error:", error);

    if (res.headersSent) {
      return undefined;
    }

    const statusCode =
      error.statusCode || error.$metadata?.httpStatusCode || 500;

    return res.status(statusCode).json({
      status: "error",

      message:
        statusCode === 404
          ? "Resume file not found."
          : statusCode === 403
            ? "Resume access denied."
            : "Failed to load resume.",
    });
  }
};

// ======================================================
// UPDATE APPLICATION STATUS
// ======================================================

exports.updateProviderApplicationStatus = async (req, res) => {
  try {
    const registerId = req.registerId;

    const { applicationId } = req.params;

    const { status } = req.body;

    if (!registerId) {
      return res.status(401).json({
        status: "error",

        message: "Provider authentication required.",
      });
    }

    if (!status) {
      return res.status(400).json({
        status: "error",

        message: "status is required.",
      });
    }

    if (!PROVIDER_UPDATE_STATUSES.includes(status)) {
      return res.status(400).json({
        status: "error",

        message: "Invalid application status.",
      });
    }

    const application = await Application.findOne({
      application_id: applicationId,

      provider_id: registerId,

      status: {
        $in: PROVIDER_VISIBLE_STATUSES,
      },
    });

    if (!application) {
      return res.status(404).json({
        status: "error",

        message: "Application not found.",
      });
    }

    if (application.status === "HIRED" || application.status === "REJECTED") {
      return res.status(400).json({
        status: "error",

        message: "This application has already been completed.",
      });
    }

    application.status = status;

    await application.save();

    const vacancy = await Vacancy.findOne({
      vacancyId: application.vacancy_id,

      registerId,
    });

    return res.status(200).json({
      status: "success",

      message: "Application status updated successfully.",

      data: toProviderApplication(
        application,

        vacancy,
      ),
    });
  } catch (error) {
    console.error("Update provider application status error:", error);

    return res.status(500).json({
      status: "error",

      message: "Failed to update application status.",
    });
  }
};
