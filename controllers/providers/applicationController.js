const fs = require("fs");
const path = require("path");

const Application = require("../../models/applications/applicationSchema");

const Vacancy = require("../../models/providers/vacancySchema");

const { APPLICATION_RESUME_DIR } = require("../../services/resumeService");

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
//
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
// IMPORTANT:
//
// Provider may see:
//
// - Candidate name
// - Nationality
// - Visa
// - Japanese level
// - Skills
// - Education
// - Employment history
// - Professional resume
//
// Provider must NOT receive:
//
// - seeker_id
// - email
// - phone
// - full address
// - private documents
// - generated resume file path
//
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

    // ==================================================
    // RESUME AVAILABILITY
    // ==================================================

    resume_available: Boolean(data.profile_snapshot?.generated_resume_file),

    // ==================================================
    // PROFESSIONAL APPLICANT PROFILE
    // ==================================================

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

    // ==================================================
    // VACANCY
    // ==================================================

    vacancy: toProviderVacancySummary(vacancy),
  };
};

// ======================================================
// GET PROVIDER APPLICATIONS
//
// GET /api/providers/applications
//
// Only applications belonging to logged-in provider.
//
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

    // ================================================
    // FILTER
    // ================================================

    const filter = {
      provider_id: registerId,

      status: {
        $in: PROVIDER_VISIBLE_STATUSES,
      },
    };

    // ================================================
    // OPTIONAL STATUS FILTER
    // ================================================

    if (status) {
      if (!PROVIDER_VISIBLE_STATUSES.includes(status)) {
        return res.status(400).json({
          status: "error",

          message: "Invalid application status.",
        });
      }

      filter.status = status;
    }

    // ================================================
    // APPLICATIONS
    // ================================================

    const applications = await Application.find(filter).sort({
      applied_at: -1,
    });

    // ================================================
    // GET VACANCY IDS
    // ================================================

    const vacancyIds = [
      ...new Set(applications.map((application) => application.vacancy_id)),
    ];

    // ================================================
    // RELATED VACANCIES
    // ================================================

    const vacancies =
      vacancyIds.length > 0
        ? await Vacancy.find({
            vacancyId: {
              $in: vacancyIds,
            },

            registerId,
          })
        : [];

    // ================================================
    // VACANCY LOOKUP MAP
    // ================================================

    const vacancyMap = new Map(
      vacancies.map((vacancy) => [vacancy.vacancyId, vacancy]),
    );

    // ================================================
    // SAFE RESPONSE
    // ================================================

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
//
// GET
// /api/providers/applications/:applicationId
//
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

    // ================================================
    // APPLICATION MUST BELONG TO THIS PROVIDER
    // ================================================

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

    // ================================================
    // RELATED VACANCY
    // ================================================

    const vacancy = await Vacancy.findOne({
      vacancyId: application.vacancy_id,

      registerId,
    });

    // ================================================
    // RESPONSE
    // ================================================

    return res.status(200).json({
      status: "success",

      data: toProviderApplication(application, vacancy),
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
// GET APPLICATION RESUME
//
// GET
// /api/providers/applications/:applicationId/resume
//
// Provider can only access:
//
// - application belonging to them
// - application already approved by Admin
// - application-specific resume
//
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

    // ================================================
    // APPLICATION OWNERSHIP
    // ================================================

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

    // ================================================
    // RESUME PATH
    // ================================================

    const resumePath = application.profile_snapshot?.generated_resume_file;

    if (!resumePath) {
      return res.status(404).json({
        status: "error",

        message: "Resume is not available.",
      });
    }

    // ================================================
    // SECURITY
    //
    // Never allow arbitrary paths.
    // Only application-specific generated resumes.
    // ================================================

    if (!resumePath.startsWith("application-resumes/")) {
      return res.status(403).json({
        status: "error",

        message: "Resume access denied.",
      });
    }

    // ================================================
    // FILE NAME
    // ================================================

    const fileName = path.basename(resumePath);

    const absolutePath = path.join(APPLICATION_RESUME_DIR, fileName);

    // ================================================
    // FILE EXISTS
    // ================================================

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({
        status: "error",

        message: "Resume file not found.",
      });
    }

    // ================================================
    // SEND PDF
    // ================================================

    res.setHeader("Content-Type", "application/pdf");

    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);

    return res.sendFile(absolutePath);
  } catch (error) {
    console.error("Provider resume error:", error);

    return res.status(500).json({
      status: "error",

      message: "Failed to load resume.",
    });
  }
};

// ======================================================
// UPDATE APPLICATION STATUS
//
// PATCH
// /api/providers/applications/:applicationId/status
//
// BODY EXAMPLES:
//
// {
//   "status": "UNDER_REVIEW"
// }
//
// {
//   "status": "INTERVIEW"
// }
//
// {
//   "status": "SELECTED"
// }
//
// {
//   "status": "HIRED"
// }
//
// {
//   "status": "REJECTED"
// }
//
// ======================================================

exports.updateProviderApplicationStatus = async (req, res) => {
  try {
    const registerId = req.registerId;

    const { applicationId } = req.params;

    const { status } = req.body;

    // ================================================
    // AUTH
    // ================================================

    if (!registerId) {
      return res.status(401).json({
        status: "error",

        message: "Provider authentication required.",
      });
    }

    // ================================================
    // STATUS REQUIRED
    // ================================================

    if (!status) {
      return res.status(400).json({
        status: "error",

        message: "status is required.",
      });
    }

    // ================================================
    // VALID STATUS
    // ================================================

    if (!PROVIDER_UPDATE_STATUSES.includes(status)) {
      return res.status(400).json({
        status: "error",

        message: "Invalid application status.",
      });
    }

    // ================================================
    // FIND APPLICATION
    //
    // Provider ownership is mandatory.
    // ================================================

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

    // ================================================
    // TERMINAL APPLICATIONS
    // ================================================

    if (application.status === "HIRED" || application.status === "REJECTED") {
      return res.status(400).json({
        status: "error",

        message: "This application has already been completed.",
      });
    }

    // ================================================
    // UPDATE
    // ================================================

    application.status = status;

    await application.save();

    // ================================================
    // RELATED VACANCY
    // ================================================

    const vacancy = await Vacancy.findOne({
      vacancyId: application.vacancy_id,

      registerId,
    });

    // ================================================
    // RESPONSE
    // ================================================

    return res.status(200).json({
      status: "success",

      message: "Application status updated successfully.",

      data: toProviderApplication(application, vacancy),
    });
  } catch (error) {
    console.error("Update provider application status error:", error);

    return res.status(500).json({
      status: "error",

      message: "Failed to update application status.",
    });
  }
};
