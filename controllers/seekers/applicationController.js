const crypto = require("crypto");

const fs = require("fs");

const path = require("path");

const Application = require("../../models/applications/applicationSchema");

const Seeker = require("../../models/seekers/seekerSchema");

// This will be the SAME vacancy model used by Provider/Admin.
// Do not create a second vacancy collection.
const Vacancy = require("../../models/providers/vacancySchema");


// ======================================================
// GENERATE CUSTOM APPLICATION ID
// Example: APP-A12B34CD
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
// BUILD APPLICATION STATUS TRACKING
// ======================================================

const getStatusTracking = (status) => {
  // Admin rejected
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

  // Provider rejected
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

  const currentIndex = APPLICATION_STEPS.findIndex(
    (step) => step.key === status,
  );

  const steps = APPLICATION_STEPS.map((step, index) => {
    let state = "pending";

    if (index < currentIndex) {
      state = "completed";
    }

    if (index === currentIndex) {
      state =
        status === "HIRED"
          ? "completed"
          : "current";
    }

    return {
      ...step,
      state,
    };
  });

  const currentStep =
    APPLICATION_STEPS[currentIndex];

  return {
    current_status: status,

    current_label:
      currentStep?.label || status,

    outcome:
      status === "HIRED"
        ? "completed"
        : "in_progress",

    steps,
  };
};

// ======================================================
// SAFE APPLICATION RESPONSE FOR SEEKER
// ======================================================

const toSeekerApplication = (application) => {
  const data = application.toObject
    ? application.toObject()
    : application;

  return {
    application_id: data.application_id,
    vacancy_id: data.vacancy_id,

    cover_letter: data.cover_letter,

    profile_snapshot: {
      name:
        data.profile_snapshot?.name,

      nationality:
        data.profile_snapshot?.nationality,

      visa_type:
        data.profile_snapshot?.visa_type,

      visa_expiry_date:
        data.profile_snapshot?.visa_expiry_date,

      japanese_level:
        data.profile_snapshot?.japanese_level,

      skills:
        data.profile_snapshot?.skills || [],

      desired_job:
        data.profile_snapshot?.desired_job,

      desired_location:
        data.profile_snapshot?.desired_location,

      education:
        data.profile_snapshot?.education || [],

      employment_history:
        data.profile_snapshot?.employment_history || [],
    },

    resume_available: Boolean(
      data.profile_snapshot?.generated_resume_file,
    ),

    status: data.status,

    status_tracking:
      getStatusTracking(data.status),

    admin_rejection_reason:
      data.status === "ADMIN_REJECTED"
        ? data.admin_rejection_reason
        : null,

    admin_reviewed_at:
      data.admin_reviewed_at || null,

    applied_at: data.applied_at,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
};

const generateApplicationId = () => {
  return `APP-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
};


const {
  generateResumePdf,
  APPLICATION_RESUME_DIR,
} = require("../../services/resumeService");
// ======================================================
// BUILD PRIVACY-SAFE PROFESSIONAL SNAPSHOT
// ======================================================
//
// DO NOT include:
// - email
// - phone
// - address
// - profile photo
// - original resume
// - private documents
//
// This snapshot represents what the seeker submitted
// at the time of application.
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

    education: (seeker.education || []).map((education) => ({
      enrollment_date: education.enrollment_date,

      graduation_date: education.graduation_date,

      school_type: education.school_type,

      school: education.school,

      major: education.major,
    })),

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
// POST /api/seekers/applications
// ======================================================

exports.applyForVacancy = async (req, res) => {
  let applicationResumePath = null;

  try {
    // --------------------------------------------------
    // 1. Get logged-in seeker from JWT
    // --------------------------------------------------

    const seekerId = req.user.seeker_id;

    // --------------------------------------------------
    // 2. Get vacancyId from frontend
    // --------------------------------------------------

    const { vacancyId, coverLetter } = req.body;

    if (!vacancyId) {
      return res.status(400).json({
        success: false,
        message: "vacancyId is required.",
      });
    }

    // --------------------------------------------------
    // 3. Confirm seeker still exists
    // --------------------------------------------------

    const seeker = await Seeker.findOne({
      seeker_id: seekerId,
    });

    if (!seeker) {
      return res.status(404).json({
        success: false,
        message: "Job Seeker not found.",
      });
    }

    // --------------------------------------------------
    // 4. Confirm seeker is approved + active
    // --------------------------------------------------

    if (
      seeker.approval_status !== "approved" ||
      seeker.account_status !== "active"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Your account must be approved and active before applying for vacancies.",
      });
    }

    // --------------------------------------------------
    // 5. Find selected vacancy
    // --------------------------------------------------

    const vacancy = await Vacancy.findOne({
      vacancyId: vacancyId,
    });

    if (!vacancy) {
      return res.status(404).json({
        success: false,
        message: "Vacancy not found.",
      });
    }

    // --------------------------------------------------
    // 6. Vacancy must be published
    // --------------------------------------------------

if (
  vacancy.status !== "published" ||
  vacancy.isPublished !== true
) {
  return res.status(400).json({
    success: false,
    message:
      "This vacancy is not currently available for applications.",
  });
}
    // --------------------------------------------------
    // 7. Get provider ID FROM VACANCY
    //
    // Never accept providerId from frontend.
    // --------------------------------------------------

    const providerId = vacancy.registerId;

    if (!providerId) {
      return res.status(500).json({
        success: false,
        message: "Vacancy provider information is missing.",
      });
    }

    // --------------------------------------------------
    // 8. Prevent duplicate application
    // --------------------------------------------------

    const existingApplication = await Application.findOne({
      seeker_id: seekerId,
      vacancy_id: vacancyId,
    });

    if (existingApplication) {
      return res.status(409).json({
        success: false,
        message: "You have already applied for this vacancy.",
      });
    }

    // --------------------------------------------------
    // 9. Generate application ID
    // --------------------------------------------------

    const applicationId = generateApplicationId();

    // --------------------------------------------------
    // Generate permanent application-specific resume
    // --------------------------------------------------

    const generatedResume = await generateResumePdf(seeker, {
      type: "application",
      applicationId,
    });

    applicationResumePath = generatedResume.absolutePath;

    // --------------------------------------------------
    // 10. Capture professional profile snapshot
    // --------------------------------------------------

    const profileSnapshot = buildProfileSnapshot(seeker);

    // Use application-specific resume,
    // not the seeker's temporary/latest resume
    profileSnapshot.generated_resume_file = generatedResume.relativePath;

    // --------------------------------------------------
    // 11. Create application
    //
    // IMPORTANT:
    // It goes to Admin first.
    // Provider cannot see it yet.
    // --------------------------------------------------

    const application = await Application.create({
      application_id: applicationId,

      seeker_id: seekerId,

      vacancy_id: vacancy.vacancyId,

      provider_id: providerId,

      cover_letter: coverLetter || null,

      profile_snapshot: profileSnapshot,

      status: "PENDING_ADMIN_APPROVAL",

      applied_at: new Date(),
    });

    // --------------------------------------------------
    // 12. Return safe response
    // --------------------------------------------------

    return res.status(201).json({
      success: true,

      message:
        "Application submitted successfully and is pending admin review.",

      data: {
        applicationId: application.application_id,

        vacancyId: application.vacancy_id,

        status: application.status,

        appliedAt: application.applied_at,
      },
    });
  } catch (error) {
    console.error("Apply for vacancy error:", error);

    // If PDF was generated but application creation failed,
    // remove the orphan application resume.
    if (applicationResumePath && fs.existsSync(applicationResumePath)) {
      fs.unlinkSync(applicationResumePath);
    }

    // Duplicate protection from MongoDB unique index
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You have already applied for this vacancy.",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to submit application.",
    });
  }
};

// ======================================================
// GET LOGGED-IN SEEKER APPLICATIONS
// GET /api/seekers/applications
// ======================================================

exports.getMyApplications = async (req, res) => {
  try {
    const seekerId = req.user.seeker_id;

    const applications = await Application.find({
      seeker_id: seekerId,
    }).sort({
      applied_at: -1,
    });

    return res.status(200).json({
      success: true,
      count: applications.length,
      data: applications.map(toSeekerApplication),
    });
  } catch (error) {
    console.error("Get seeker applications error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get applications.",
    });
  }
};


// ======================================================
// GET ONE LOGGED-IN SEEKER APPLICATION
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
        message: "Application not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: toSeekerApplication(application),
    });
  } catch (error) {
    console.error(
      "Get seeker application error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to get application.",
    });
  }
};

// ======================================================
// VIEW RESUME ATTACHED TO APPLICATION
// GET /api/seekers/applications/:application_id/resume
// ======================================================

exports.getMyApplicationResume = async (req, res) => {
  try {
    const seekerId = req.user.seeker_id;
    const { application_id } = req.params;

    // Find application AND confirm it belongs
    // to the logged-in seeker.
    const application = await Application.findOne({
      application_id,
      seeker_id: seekerId,
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found.",
      });
    }

    const resumePath = application.profile_snapshot?.generated_resume_file;

    if (!resumePath) {
      return res.status(404).json({
        success: false,
        message: "No resume is attached to this application.",
      });
    }

    // Only allow application-specific resumes here.
    if (!resumePath.startsWith("application-resumes/")) {
      return res.status(404).json({
        success: false,
        message: "Application resume is not available.",
      });
    }

    const fileName = path.basename(resumePath);

    const absolutePath = path.join(APPLICATION_RESUME_DIR, fileName);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({
        success: false,
        message: "Application resume file not found.",
      });
    }

    res.setHeader("Content-Type", "application/pdf");

    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);

    return res.sendFile(absolutePath);
  } catch (error) {
    console.error("Get application resume error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get application resume.",
    });
  }
};
