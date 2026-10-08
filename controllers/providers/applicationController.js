const Application = require("../../models/applications/applicationSchema");

const Vacancy = require("../../models/providers/vacancySchema");

const Seeker = require("../../models/seekers/seekerSchema");

const {
  sendApplicationResume,
} = require("../../utils/applicationResumeStorage");

const {
  sendProviderCandidatePhoto,
} = require("../../utils/providerCandidatePhotoStorage");

// ======================================================
// PROVIDER VISIBLE APPLICATION STATUSES
//
// Provider must NOT see:
//
// - PENDING_ADMIN_APPROVAL
// - ADMIN_REJECTED
//
// Only applications approved by Admin / authorized Staff
// become visible.
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
// PROVIDER STATUS TRANSITIONS
//
// IMPORTANT:
//
// INTERVIEW is intentionally NOT directly allowed here.
//
// UNDER_REVIEW -> INTERVIEW must happen through:
//
// POST /providers/interviews
//
// This guarantees that an application cannot be moved to
// INTERVIEW without an actual interview record.
// ======================================================

const PROVIDER_STATUS_TRANSITIONS = {
  SENT_TO_PROVIDER: ["UNDER_REVIEW", "REJECTED"],

  UNDER_REVIEW: ["REJECTED"],

  INTERVIEW: ["SELECTED", "REJECTED"],

  SELECTED: ["HIRED", "REJECTED"],

  HIRED: [],

  REJECTED: [],
};

// ======================================================
// PROVIDER-SAFE EDUCATION
// ======================================================

const toProviderEducation = (education) => ({
  enrollment_date: education?.enrollment_date || null,

  graduation_date: education?.graduation_date || null,

  school_type: education?.school_type || null,

  school: education?.school || null,

  major: education?.major || null,
});

// ======================================================
// PROVIDER-SAFE EMPLOYMENT
// ======================================================

const toProviderEmployment = (employment) => ({
  start_date: employment?.start_date || null,

  end_date: employment?.end_date || null,

  employment_type: employment?.employment_type || null,

  company_name: employment?.company_name || null,
});

// ======================================================
// PROVIDER'S OWN VACANCY SUMMARY
//
// Provider may see its own company information.
//
// Job Seeker must not receive real Provider/company
// identity through the seeker-side API.
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
//
// Provider MAY receive:
//
// - candidate name
// - photo availability
// - nationality
// - visa
// - Japanese level
// - skills
// - desired job/location
// - education
// - employment history
// - professional resume availability
//
// Provider MUST NOT receive:
//
// - seeker_id
// - email
// - phone
// - home address
// - exact current location
// - direct contact information
// - raw profile_photo storage reference
// - raw resume storage reference
// - private documents
//
// IMPORTANT:
//
// photo_available is only a Boolean.
//
// Never return:
//
// seeker.profile_photo
// ======================================================

const toProviderApplication = (application, vacancy, seeker) => {
  const data = application.toObject ? application.toObject() : application;

  const snapshot = data.profile_snapshot || {};

  return {
    application_id: data.application_id,

    vacancy_id: data.vacancy_id,

    status: data.status,

    applied_at: data.applied_at,

    created_at: data.created_at,

    updated_at: data.updated_at,

    resume_available: Boolean(snapshot.generated_resume_file),

    applicant: {
      name: snapshot.name || seeker?.name || null,

      // =================================================
      // PHOTO
      //
      // Provider receives only availability.
      //
      // Actual image is requested through:
      //
      // /api/providers/applications/:applicationId/photo
      // =================================================

      photo_available: Boolean(seeker?.profile_photo),

      nationality: snapshot.nationality || seeker?.nationality || null,

      visa_type: snapshot.visa_type || seeker?.visa_type || null,

      visa_expiry_date:
        snapshot.visa_expiry_date || seeker?.visa_expiry_date || null,

      japanese_level: snapshot.japanese_level || seeker?.japanese_level || null,

      skills:
        Array.isArray(snapshot.skills) && snapshot.skills.length > 0
          ? snapshot.skills
          : Array.isArray(seeker?.skills)
            ? seeker.skills
            : [],

      desired_job: snapshot.desired_job || seeker?.desired_job || null,

      desired_location:
        snapshot.desired_location || seeker?.desired_location || null,

      education: Array.isArray(snapshot.education)
        ? snapshot.education.map(toProviderEducation)
        : [],

      employment_history: Array.isArray(snapshot.employment_history)
        ? snapshot.employment_history.map(toProviderEmployment)
        : [],
    },

    vacancy: toProviderVacancySummary(vacancy),
  };
};

// ======================================================
// LOAD RELATED SEEKERS
//
// Used ONLY internally.
//
// seeker IDs and private profile photo storage references
// are never returned to Provider.
// ======================================================

const loadSeekerMap = async (applications) => {
  const seekerIds = [
    ...new Set(
      applications.map((application) => application.seeker_id).filter(Boolean),
    ),
  ];

  if (seekerIds.length === 0) {
    return new Map();
  }

  const seekers = await Seeker.find({
    seeker_id: {
      $in: seekerIds,
    },
  })
    .select(
      [
        "seeker_id",
        "name",
        "profile_photo",
        "nationality",
        "visa_type",
        "visa_expiry_date",
        "japanese_level",
        "skills",
        "desired_job",
        "desired_location",
      ].join(" "),
    )
    .lean();

  return new Map(seekers.map((seeker) => [seeker.seeker_id, seeker]));
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

    // ==================================================
    // OPTIONAL STATUS FILTER
    // ==================================================

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

    // ==================================================
    // VACANCIES
    // ==================================================

    const vacancyIds = [
      ...new Set(
        applications
          .map((application) => application.vacancy_id)
          .filter(Boolean),
      ),
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

    // ==================================================
    // SEEKERS
    //
    // Used internally only.
    // ==================================================

    const seekerMap = await loadSeekerMap(applications);

    const data = applications.map((application) =>
      toProviderApplication(
        application,

        vacancyMap.get(application.vacancy_id),

        seekerMap.get(application.seeker_id),
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

    const [vacancy, seeker] = await Promise.all([
      Vacancy.findOne({
        vacancyId: application.vacancy_id,

        registerId,
      }),

      Seeker.findOne({
        seeker_id: application.seeker_id,
      })
        .select(
          [
            "seeker_id",
            "name",
            "profile_photo",
            "nationality",
            "visa_type",
            "visa_expiry_date",
            "japanese_level",
            "skills",
            "desired_job",
            "desired_location",
          ].join(" "),
        )
        .lean(),
    ]);

    return res.status(200).json({
      status: "success",

      data: toProviderApplication(application, vacancy, seeker),
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
// GET PROVIDER CANDIDATE PHOTO
//
// GET:
//
// /api/providers/applications/:applicationId/photo
//
// SECURITY FLOW:
//
// Provider authentication
//        ↓
// Application belongs to Provider
//        ↓
// Application already passed Admin/Staff approval
//        ↓
// Get internal seeker_id
//        ↓
// Load private profile_photo
//        ↓
// Validate/storage utility
//        ↓
// Stream image
//
// NEVER returns:
//
// - seekerId
// - storage URL
// - storage key
// ======================================================

exports.getProviderApplicationPhoto = async (req, res) => {
  try {
    const registerId = req.registerId;

    const { applicationId } = req.params;

    if (!registerId) {
      return res.status(401).json({
        status: "error",

        message: "Provider authentication required.",
      });
    }

    // ==================================================
    // APPLICATION OWNERSHIP + APPROVAL
    // ==================================================

    const application = await Application.findOne({
      application_id: applicationId,

      provider_id: registerId,

      status: {
        $in: PROVIDER_VISIBLE_STATUSES,
      },
    })
      .select("application_id seeker_id")
      .lean();

    if (!application) {
      return res.status(404).json({
        status: "error",

        message: "Application not found.",
      });
    }

    // ==================================================
    // SEEKER PHOTO
    //
    // seeker_id is used only internally.
    // ==================================================

    const seeker = await Seeker.findOne({
      seeker_id: application.seeker_id,
    })
      .select("seeker_id profile_photo")
      .lean();

    if (!seeker || !seeker.profile_photo) {
      return res.status(404).json({
        status: "error",

        message: "Candidate photo is not available.",
      });
    }

    // ==================================================
    // PRIVATE STREAM
    // ==================================================

    await sendProviderCandidatePhoto({
      res,

      storedPath: seeker.profile_photo,

      seekerId: seeker.seeker_id,
    });

    return undefined;
  } catch (error) {
    console.error("Provider candidate photo error:", error);

    if (res.headersSent) {
      return undefined;
    }

    const statusCode =
      error.statusCode || error.$metadata?.httpStatusCode || 500;

    return res.status(statusCode).json({
      status: "error",

      message:
        statusCode === 404
          ? "Candidate photo not found."
          : statusCode === 403
            ? "Candidate photo access denied."
            : "Failed to load candidate photo.",
    });
  }
};

// ======================================================
// GET APPLICATION FROZEN RESUME
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
//
// IMPORTANT:
//
// Status transitions are enforced on backend.
//
// Direct:
//
// UNDER_REVIEW -> INTERVIEW
//
// is NOT allowed.
//
// Interview status must be created through:
//
// POST /providers/interviews
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

    // ==================================================
    // STATUS REQUIRED
    // ==================================================

    if (!status) {
      return res.status(400).json({
        status: "error",

        message: "status is required.",
      });
    }

    // ==================================================
    // LOAD PROVIDER'S APPLICATION
    // ==================================================

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

    // ==================================================
    // VALIDATE STATUS TRANSITION
    // ==================================================

    const allowedNextStatuses =
      PROVIDER_STATUS_TRANSITIONS[application.status] || [];

    if (!allowedNextStatuses.includes(status)) {
      return res.status(400).json({
        status: "error",

        message: `Cannot change application status from ${application.status} to ${status}.`,
      });
    }

    // ==================================================
    // UPDATE
    // ==================================================

    application.status = status;

    await application.save();

    // ==================================================
    // LOAD SAFE RELATED INFORMATION
    // ==================================================

    const [vacancy, seeker] = await Promise.all([
      Vacancy.findOne({
        vacancyId: application.vacancy_id,

        registerId,
      }),

      Seeker.findOne({
        seeker_id: application.seeker_id,
      })
        .select(
          [
            "seeker_id",
            "name",
            "profile_photo",
            "nationality",
            "visa_type",
            "visa_expiry_date",
            "japanese_level",
            "skills",
            "desired_job",
            "desired_location",
          ].join(" "),
        )
        .lean(),
    ]);

    return res.status(200).json({
      status: "success",

      message: "Application status updated successfully.",

      data: toProviderApplication(application, vacancy, seeker),
    });
  } catch (error) {
    console.error("Update provider application status error:", error);

    return res.status(500).json({
      status: "error",

      message: "Failed to update application status.",
    });
  }
};
