const crypto = require("crypto");

const Application = require(
  "../../models/applications/applicationSchema",
);

const Seeker = require(
  "../../models/seekers/seekerSchema",
);

// This will be the SAME vacancy model used by Provider/Admin.
// Do not create a second vacancy collection.
const Vacancy = require(
  "../../models/vacancies/vacancySchema",
);

// ======================================================
// GENERATE CUSTOM APPLICATION ID
// Example: APP-A12B34CD
// ======================================================

const generateApplicationId = () => {
  return `APP-${crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase()}`;
};

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

    visa_expiry_date:
      seeker.visa_expiry_date,

    japanese_level:
      seeker.japanese_level,

    skills: seeker.skills || [],

    desired_job:
      seeker.desired_job,

    desired_location:
      seeker.desired_location,

    education: (
      seeker.education || []
    ).map((education) => ({
      enrollment_date:
        education.enrollment_date,

      graduation_date:
        education.graduation_date,

      school_type:
        education.school_type,

      school:
        education.school,

      major:
        education.major,
    })),

    employment_history: (
      seeker.employment_history || []
    ).map((employment) => ({
      start_date:
        employment.start_date,

      end_date:
        employment.end_date,

      employment_type:
        employment.employment_type,

      company_name:
        employment.company_name,
    })),

    generated_resume_file:
      seeker.generated_resume_file,
  };
};

// ======================================================
// APPLY FOR VACANCY
// POST /api/seekers/applications
// ======================================================

exports.applyForVacancy = async (
  req,
  res,
) => {
  try {
    // --------------------------------------------------
    // 1. Get logged-in seeker from JWT
    // --------------------------------------------------

    const seekerId =
      req.user.seeker_id;

    // --------------------------------------------------
    // 2. Get vacancyId from frontend
    // --------------------------------------------------

    const {
      vacancyId,
      coverLetter,
    } = req.body;

    if (!vacancyId) {
      return res.status(400).json({
        success: false,
        message:
          "vacancyId is required.",
      });
    }

    // --------------------------------------------------
    // 3. Confirm seeker still exists
    // --------------------------------------------------

    const seeker =
      await Seeker.findOne({
        seeker_id: seekerId,
      });

    if (!seeker) {
      return res.status(404).json({
        success: false,
        message:
          "Job Seeker not found.",
      });
    }

    // --------------------------------------------------
    // 4. Confirm seeker is approved + active
    // --------------------------------------------------

    if (
      seeker.approval_status !==
        "approved" ||
      seeker.account_status !==
        "active"
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

    const vacancy =
      await Vacancy.findOne({
        vacancy_id: vacancyId,
      });

    if (!vacancy) {
      return res.status(404).json({
        success: false,
        message:
          "Vacancy not found.",
      });
    }

    // --------------------------------------------------
    // 6. Vacancy must be published
    // --------------------------------------------------

    if (
      vacancy.status !==
      "published"
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

    const providerId =
      vacancy.provider_id;

    if (!providerId) {
      return res.status(500).json({
        success: false,
        message:
          "Vacancy provider information is missing.",
      });
    }

    // --------------------------------------------------
    // 8. Prevent duplicate application
    // --------------------------------------------------

    const existingApplication =
      await Application.findOne({
        seeker_id: seekerId,
        vacancy_id: vacancyId,
      });

    if (existingApplication) {
      return res.status(409).json({
        success: false,
        message:
          "You have already applied for this vacancy.",
      });
    }

    // --------------------------------------------------
    // 9. Generate application ID
    // --------------------------------------------------

    const applicationId =
      generateApplicationId();

    // --------------------------------------------------
    // 10. Capture professional profile snapshot
    // --------------------------------------------------

    const profileSnapshot =
      buildProfileSnapshot(
        seeker,
      );

    // --------------------------------------------------
    // 11. Create application
    //
    // IMPORTANT:
    // It goes to Admin first.
    // Provider cannot see it yet.
    // --------------------------------------------------

    const application =
      await Application.create({
        application_id:
          applicationId,

        seeker_id:
          seekerId,

        vacancy_id:
          vacancy.vacancy_id,

        provider_id:
          providerId,

        cover_letter:
          coverLetter || null,

        profile_snapshot:
          profileSnapshot,

        status:
          "PENDING_ADMIN_APPROVAL",

        applied_at:
          new Date(),
      });

    // --------------------------------------------------
    // 12. Return safe response
    // --------------------------------------------------

    return res.status(201).json({
      success: true,

      message:
        "Application submitted successfully and is pending admin review.",

      data: {
        applicationId:
          application.application_id,

        vacancyId:
          application.vacancy_id,

        status:
          application.status,

        appliedAt:
          application.applied_at,
      },
    });
  } catch (error) {
    console.error(
      "Apply for vacancy error:",
      error,
    );

    // Duplicate protection from MongoDB unique index
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "You have already applied for this vacancy.",
      });
    }

    if (
      error.name ===
      "ValidationError"
    ) {
      return res.status(400).json({
        success: false,
        message:
          error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to submit application.",
    });
  }
};