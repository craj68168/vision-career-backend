const crypto = require("crypto");

const Application = require("../../models/applications/applicationSchema");
const Seeker = require("../../models/seekers/seekerSchema");
const Vacancy = require("../../models/providers/vacancySchema");

const {
  calculatePlacementEligibility,
} = require("../../utils/seekerProfileStatus");

const { generateResumePdf } = require("../../services/resumeService");
const { uploadBuffer } = require("../../services/storageService");

const { createStorageReference } = require("../../utils/storageReference");

const {
  deleteApplicationResumeReference,
  sendApplicationResume,
} = require("../../utils/applicationResumeStorage");

const { seekerMessage } = require("../../utils/seekerMessages");

const t = (req, en, ja) => seekerMessage(req, { en, ja });

// ======================================================
// GET START OF TODAY
//
// Used for application deadline checks.
//
// A vacancy with:
//
// applicationDeadline = 2026-09-16
//
// remains applyable during September 16.
//
// It becomes expired from September 17.
// ======================================================

const getTodayStartUTC = () => {
  const today = new Date();

  today.setUTCHours(0, 0, 0, 0);

  return today;
};

// ======================================================
// APPLICATION TRACKING STEPS
// ======================================================

const APPLICATION_STEPS = [
  {
    key: "PENDING_ADMIN_APPROVAL",
    label: "Application Submitted",
  },
  {
    key: "SENT_TO_PROVIDER",
    label: "Sent to Employer",
  },
  {
    key: "UNDER_REVIEW",
    label: "Under Review",
  },
  {
    key: "INTERVIEW",
    label: "Interview",
  },
  {
    key: "SELECTED",
    label: "Selected",
  },
  {
    key: "HIRED",
    label: "Hired",
  },
];

// ======================================================
// GENERATE APPLICATION ID
//
// Example:
//
// APP-A12B34CD
// ======================================================

const generateApplicationId = () => {
  return `APP-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
};

// ======================================================
// BUILD APPLICATION STATUS TRACKING
// ======================================================

const getStatusTracking = (status) => {
  // ==================================================
  // ADMIN REJECTED
  // ==================================================

  if (status === "ADMIN_REJECTED") {
    return {
      current_status: status,

      current_label: "Not Approved",

      outcome: "rejected",

      steps: [
        {
          key: "PENDING_ADMIN_APPROVAL",
          label: "Application Submitted",
          state: "completed",
        },
        {
          key: "ADMIN_REJECTED",
          label: "Not Approved",
          state: "rejected",
        },
      ],
    };
  }

  // ==================================================
  // PROVIDER REJECTED
  // ==================================================

  if (status === "REJECTED") {
    return {
      current_status: status,

      current_label: "Not Selected",

      outcome: "rejected",

      steps: [
        {
          key: "PENDING_ADMIN_APPROVAL",
          label: "Application Submitted",
          state: "completed",
        },
        {
          key: "SENT_TO_PROVIDER",
          label: "Sent to Employer",
          state: "completed",
        },
        {
          key: "REJECTED",
          label: "Not Selected",
          state: "rejected",
        },
      ],
    };
  }

  // ==================================================
  // NORMAL STATUS
  // ==================================================

  const currentIndex = APPLICATION_STEPS.findIndex(
    (step) => step.key === status,
  );

  const steps = APPLICATION_STEPS.map((step, index) => {
    let state = "pending";

    if (index < currentIndex) {
      state = "completed";
    }

    if (index === currentIndex) {
      state = status === "HIRED" ? "completed" : "current";
    }

    return {
      ...step,
      state,
    };
  });

  const currentStep = APPLICATION_STEPS[currentIndex];

  return {
    current_status: status,

    current_label: currentStep?.label || status,

    outcome: status === "HIRED" ? "completed" : "in_progress",

    steps,
  };
};

// ======================================================
// SAFE APPLICATION RESPONSE FOR SEEKER
// ======================================================

const toSeekerApplication = (application) => {
  const data = application.toObject ? application.toObject() : application;

  return {
    // ==================================================
    // IDS
    // ==================================================

    application_id: data.application_id,

    vacancy_id: data.vacancy_id,

    // ==================================================
    // APPLICATION
    // ==================================================

    cover_letter: data.cover_letter,

    // ==================================================
    // PROFILE SNAPSHOT
    // ==================================================

    profile_snapshot: {
      name: data.profile_snapshot?.name,

      nationality: data.profile_snapshot?.nationality,

      visa_type: data.profile_snapshot?.visa_type,

      visa_expiry_date: data.profile_snapshot?.visa_expiry_date,

      japanese_level: data.profile_snapshot?.japanese_level,

      skills: data.profile_snapshot?.skills || [],

      desired_job: data.profile_snapshot?.desired_job,

      desired_location: data.profile_snapshot?.desired_location,

      education: data.profile_snapshot?.education || [],

      employment_history: data.profile_snapshot?.employment_history || [],
    },

    // ==================================================
    // RESUME
    // ==================================================

    resume_available: Boolean(data.profile_snapshot?.generated_resume_file),

    // ==================================================
    // STATUS
    // ==================================================

    status: data.status,

    status_tracking: getStatusTracking(data.status),

    // ==================================================
    // ADMIN REVIEW
    // ==================================================

    admin_rejection_reason:
      data.status === "ADMIN_REJECTED" ? data.admin_rejection_reason : null,

    admin_reviewed_at: data.admin_reviewed_at || null,

    // ==================================================
    // DATES
    // ==================================================

    applied_at: data.applied_at,

    created_at: data.created_at,

    updated_at: data.updated_at,
  };
};

// ======================================================
// SEEKER-SAFE VACANCY SUMMARY
//
// Used inside My Applications.
//
// Do NOT expose:
//
// - registerId
// - contactPerson
// - contactEmail
// - workLocationDetail
// ======================================================

const toSeekerVacancySummary = (vacancy) => {
  if (!vacancy) {
    return null;
  }

  return {
    vacancyId: vacancy.vacancyId,

    companyName: vacancy.companyName,

    companyNameKana: vacancy.companyNameKana,

    title: vacancy.title,

    titleKana: vacancy.titleKana,

    employmentType: vacancy.employmentType,

    numberOfPeople: vacancy.numberOfPeople,

    jobDescription: vacancy.jobDescription,

    japaneseLevel: vacancy.japaneseLevel,

    workLocation: vacancy.workLocation,

    remoteWork: vacancy.remoteWork,

    salaryMin: vacancy.salaryMin,

    salaryMax: vacancy.salaryMax,

    status: vacancy.status,

    createdAt: vacancy.createdAt,
  };
};

// ======================================================
// BUILD PROFESSIONAL PROFILE SNAPSHOT
//
// DO NOT include:
//
// - email
// - phone
// - address
// - profile photo
// - private documents
// ======================================================

const buildProfileSnapshot = (seeker) => {
  return {
    name: seeker.name,

    nationality: seeker.nationality,

    visa_type: seeker.visa_type,

    visa_expiry_date: seeker.visa_expiry_date,

    japanese_level: seeker.japanese_level,

    skills: seeker.skills || [],

    desired_job: seeker.desired_job,

    desired_location: seeker.desired_location,

    // ==================================================
    // EDUCATION
    // ==================================================

    education: (seeker.education || []).map((education) => ({
      enrollment_date: education.enrollment_date,

      graduation_date: education.graduation_date,

      school_type: education.school_type,

      school: education.school,

      major: education.major,
    })),

    // ==================================================
    // EMPLOYMENT
    // ==================================================

    employment_history: (seeker.employment_history || []).map((employment) => ({
      start_date: employment.start_date,

      end_date: employment.end_date,

      employment_type: employment.employment_type,

      company_name: employment.company_name,
    })),
  };
};

// ======================================================
// APPLY FOR VACANCY
//
// POST /api/seekers/applications
//
// BODY:
//
// {
//   "vacancyId": "V-000017",
//   "coverLetter": null
// }
// ======================================================

exports.applyForVacancy = async (req, res) => {
  let applicationId = null;

  let applicationResumeReference = null;

  try {
    // ==================================================
    // LOGGED-IN SEEKER
    // ==================================================

    const seekerId = req.user.seeker_id;

    // ==================================================
    // REQUEST DATA
    // ==================================================

    const { vacancyId, coverLetter } = req.body;

    if (!vacancyId) {
      return res.status(400).json({
        success: false,

        message: t(req, "vacancyId is required.", "求人IDは必須です。"),
      });
    }

    // ==================================================
    // FIND SEEKER
    // ==================================================

    const seeker = await Seeker.findOne({
      seeker_id: seekerId,
    });

    if (!seeker) {
      return res.status(404).json({
        success: false,

        message: t(req, "Job Seeker not found.", "求職者が見つかりません。"),
      });
    }

    // ==================================================
    // SEEKER MUST BE PLACEMENT ELIGIBLE
    //
    // This shared eligibility check verifies:
    //
    // - account approval
    // - account active status
    // - required profile completion
    //
    // The same business rule is used by placement
    // candidate matching.
    // ==================================================

    const placementEligibility = calculatePlacementEligibility(seeker);

    if (!placementEligibility.isEligible) {
      return res.status(403).json({
        success: false,

        status: "NOT_PLACEMENT_ELIGIBLE",

        message: !placementEligibility.profile.isComplete
          ? t(
              req,
              "Please complete your profile before applying for vacancies.",
              "求人に応募する前にプロフィールを完成させてください。",
            )
          : t(
              req,
              "Your account is not currently eligible to apply for vacancies.",
              "現在、このアカウントでは求人に応募できません。",
            ),

        data: {
          placement_eligible: false,

          placement_status: placementEligibility.status,

          profile_complete: placementEligibility.profile.isComplete,

          completion_percentage:
            placementEligibility.profile.completionPercentage,

          missing_fields: placementEligibility.profile.missingFields,

          reasons: placementEligibility.reasons,
        },
      });
    }

    // ==================================================
    // FIND VACANCY
    // ==================================================

    const vacancy = await Vacancy.findOne({
      vacancyId,
    });

    if (!vacancy) {
      return res.status(404).json({
        success: false,

        message: t(req, "Vacancy not found.", "求人情報が見つかりません。"),
      });
    }

    // ==================================================
    // VACANCY MUST BE PUBLISHED
    // ==================================================

    if (vacancy.status !== "published" || vacancy.isPublished !== true) {
      return res.status(400).json({
        success: false,

        message: t(
          req,
          "This vacancy is not currently available for applications.",
          "この求人は現在応募できません。",
        ),
      });
    }

    // ==================================================
    // APPLICATION DEADLINE
    // ==================================================

    const todayStart = getTodayStartUTC();

    if (
      vacancy.applicationDeadline &&
      vacancy.applicationDeadline < todayStart
    ) {
      return res.status(400).json({
        success: false,

        message: t(
          req,
          "The application deadline for this vacancy has passed.",
          "この求人の応募期限は終了しています。",
        ),
      });
    }

    // ==================================================
    // PROVIDER ID FROM VACANCY
    // ==================================================

    const providerId = vacancy.registerId;

    if (!providerId) {
      return res.status(500).json({
        success: false,

        message: t(
          req,
          "Vacancy provider information is missing.",
          "求人企業情報が見つかりません。",
        ),
      });
    }

    // ==================================================
    // DUPLICATE APPLICATION CHECK
    // ==================================================

    const existingApplication = await Application.findOne({
      seeker_id: seekerId,

      vacancy_id: vacancy.vacancyId,
    });

    if (existingApplication) {
      return res.status(409).json({
        success: false,

        message: t(
          req,
          "You have already applied for this vacancy.",
          "この求人には既に応募済みです。",
        ),
      });
    }

    // ==================================================
    // GENERATE APPLICATION ID
    // ==================================================

    applicationId = generateApplicationId();

    // ==================================================
    // GENERATE APPLICATION-SPECIFIC FROZEN RESUME
    // ==================================================

    const generatedResume = await generateResumePdf(seeker, {
      type: "application",

      applicationId,
    });

    // ==================================================
    // UPLOAD FROZEN RESUME
    //
    // Current storage service decides whether this is
    // Supabase / Spaces according to environment.
    //
    // applications/
    //   APP-XXXXXXXX/
    //     resume/
    //       uuid-APP-XXXXXXXX.pdf
    // ==================================================

    const uploadedResume = await uploadBuffer({
      buffer: generatedResume.buffer,

      fileName: generatedResume.fileName,

      mimeType: "application/pdf",

      folder: `applications/${applicationId}/resume`,
    });

    applicationResumeReference = createStorageReference(uploadedResume.key);

    // ==================================================
    // BUILD PROFILE SNAPSHOT
    // ==================================================

    const profileSnapshot = buildProfileSnapshot(seeker);

    profileSnapshot.generated_resume_file = applicationResumeReference;

    // ==================================================
    // CREATE APPLICATION
    // ==================================================

    const application = await Application.create({
      application_id: applicationId,

      seeker_id: seekerId,

      vacancy_id: vacancy.vacancyId,

      provider_id: providerId,

      cover_letter: coverLetter?.trim() ? coverLetter.trim() : null,

      profile_snapshot: profileSnapshot,

      status: "PENDING_ADMIN_APPROVAL",

      applied_at: new Date(),
    });

    // ==================================================
    // DATABASE SAVE SUCCEEDED
    //
    // The frozen resume now belongs permanently to this
    // application.
    // ==================================================

    applicationResumeReference = null;

    // ==================================================
    // SUCCESS
    // ==================================================

    return res.status(201).json({
      success: true,

      message: t(
        req,
        "Application submitted successfully and is pending admin review.",
        "応募を送信しました。管理者の確認待ちです。",
      ),

      data: {
        applicationId: application.application_id,

        vacancyId: application.vacancy_id,

        status: application.status,

        appliedAt: application.applied_at,
      },
    });
  } catch (error) {
    console.error("Apply for vacancy error:", error);

    // ==================================================
    // REMOVE ORPHAN APPLICATION RESUME
    //
    // Example:
    //
    // Upload succeeds but MongoDB application creation
    // fails.
    // ==================================================

    if (applicationResumeReference) {
      try {
        await deleteApplicationResumeReference({
          storedPath: applicationResumeReference,

          applicationId,
        });
      } catch (cleanupError) {
        console.error("Application resume cleanup error:", cleanupError);
      }
    }

    // ==================================================
    // DUPLICATE APPLICATION
    // ==================================================

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,

        message: t(
          req,
          "You have already applied for this vacancy.",
          "この求人には既に応募済みです。",
        ),
      });
    }

    // ==================================================
    // MONGOOSE VALIDATION
    // ==================================================

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,

        message: t(
          req,
          "Please check your application and try again.",
          "応募内容を確認してもう一度お試しください。",
        ),
      });
    }

    return res.status(500).json({
      success: false,

      message: t(
        req,
        "Failed to submit application.",
        "応募の送信に失敗しました。",
      ),
    });
  }
};

// ======================================================
// GET MY APPLICATIONS
//
// GET /api/seekers/applications
// ======================================================

exports.getMyApplications = async (req, res) => {
  try {
    const seekerId = req.user.seeker_id;

    const { status } = req.query;

    const filter = {
      seeker_id: seekerId,
    };

    if (status) {
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
          })
        : [];

    const vacancyMap = new Map(
      vacancies.map((vacancy) => [vacancy.vacancyId, vacancy]),
    );

    const data = applications.map((application) => ({
      ...toSeekerApplication(application),

      vacancy: toSeekerVacancySummary(vacancyMap.get(application.vacancy_id)),
    }));

    return res.status(200).json({
      success: true,

      count: data.length,

      data,
    });
  } catch (error) {
    console.error("Get seeker applications error:", error);

    return res.status(500).json({
      success: false,

      message: t(
        req,
        "Failed to get applications.",
        "応募一覧の取得に失敗しました。",
      ),
    });
  }
};

// ======================================================
// GET ONE APPLICATION
//
// GET /api/seekers/applications/:application_id
// ======================================================

exports.getMyApplicationById = async (req, res) => {
  try {
    const seekerId = req.user.seeker_id;

    const { application_id } = req.params;

    const application = await Application.findOne({
      application_id,

      seeker_id: seekerId,
    });

    if (!application) {
      return res.status(404).json({
        success: false,

        message: t(req, "Application not found.", "応募情報が見つかりません。"),
      });
    }

    const vacancy = await Vacancy.findOne({
      vacancyId: application.vacancy_id,
    });

    return res.status(200).json({
      success: true,

      data: {
        ...toSeekerApplication(application),

        vacancy: toSeekerVacancySummary(vacancy),
      },
    });
  } catch (error) {
    console.error("Get seeker application error:", error);

    return res.status(500).json({
      success: false,

      message: t(
        req,
        "Failed to get application.",
        "応募情報の取得に失敗しました。",
      ),
    });
  }
};

// ======================================================
// VIEW APPLICATION FROZEN RESUME
//
// GET
//
// /api/seekers/applications/:application_id/resume
// ======================================================

exports.getMyApplicationResume = async (req, res) => {
  try {
    const seekerId = req.user.seeker_id;

    const { application_id } = req.params;

    const application = await Application.findOne({
      application_id,

      seeker_id: seekerId,
    }).lean();

    if (!application) {
      return res.status(404).json({
        success: false,

        message: t(req, "Application not found.", "応募情報が見つかりません。"),
      });
    }

    // ==================================================
    // FROZEN APPLICATION RESUME ONLY
    // ==================================================

    const storedResume = application.profile_snapshot?.generated_resume_file;

    if (!storedResume) {
      return res.status(404).json({
        success: false,

        message: t(
          req,
          "No resume is attached to this application.",
          "この応募には履歴書が添付されていません。",
        ),
      });
    }

    // ==================================================
    // Supports:
    //
    // New:
    //
    // storage://applications/...
    //
    // Legacy:
    //
    // application-resumes/APP-XXXXXXXX.pdf
    // ==================================================

    await sendApplicationResume({
      res,

      storedPath: storedResume,

      applicationId: application.application_id,
    });

    return undefined;
  } catch (error) {
    console.error("Get application resume error:", error);

    if (res.headersSent) {
      return undefined;
    }

    const statusCode =
      error.statusCode || error.$metadata?.httpStatusCode || 500;

    return res.status(statusCode).json({
      success: false,

      message:
        statusCode === 404
          ? t(
              req,
              "Application resume file not found.",
              "応募時の履歴書ファイルが見つかりません。",
            )
          : statusCode === 403
            ? t(
                req,
                "Application resume access denied.",
                "応募時の履歴書にアクセスできません。",
              )
            : t(
                req,
                "Failed to get application resume.",
                "応募時の履歴書の取得に失敗しました。",
              ),
    });
  }
};
