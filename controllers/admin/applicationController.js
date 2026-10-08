const Application = require("../../models/applications/applicationSchema");

const Seeker = require("../../models/seekers/seekerSchema");

const Vacancy = require("../../models/providers/vacancySchema");

const Provider = require("../../models/providers/registerSchema");

const Staff = require("../../models/admin/staffSchema");

const Admin = require("../../models/admin/adminSchema");

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
// NORMALIZE ACTOR ID
// ======================================================

const normalizeActorId = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return String(value).trim().toUpperCase();
};

// ======================================================
// GET ACTOR TYPE FROM ID
//
// STF-* => Staff
// ADM-* => Admin
// ======================================================

const getActorTypeFromId = (actorId) => {
  const normalized = normalizeActorId(actorId);

  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("STF-")) {
    return "staff";
  }

  if (normalized.startsWith("ADM-")) {
    return "admin";
  }

  return null;
};

// ======================================================
// GET STAFF NAME
// ======================================================

const getStaffName = (staffId, staffMap) => {
  const normalized = normalizeActorId(staffId);

  if (!normalized) {
    return null;
  }

  return staffMap.get(normalized)?.name || null;
};

// ======================================================
// GET ADMIN NAME
//
// Current Admin model uses username rather than a
// separate display-name field.
//
// Therefore:
//
// reviewedByName = admin.username
//
// Example:
//
// Admin ID: ADM-83401E5E
// Reviewed By: admin
// ======================================================

const getAdminName = (adminId, adminMap) => {
  const normalized = normalizeActorId(adminId);

  if (!normalized) {
    return null;
  }

  return adminMap.get(normalized)?.username || null;
};

// ======================================================
// GET REVIEW ACTOR NAME
// ======================================================

const getReviewActorName = (actorId, staffMap, adminMap) => {
  const actorType = getActorTypeFromId(actorId);

  if (actorType === "staff") {
    return getStaffName(actorId, staffMap);
  }

  if (actorType === "admin") {
    return getAdminName(actorId, adminMap);
  }

  return null;
};

// ======================================================
// STAFF SCREENING SERIALIZER
// ======================================================

const serializeStaffScreening = (application, staffMap = new Map()) => {
  const staffId = application.screened_by_staff_id || null;

  return {
    status: application.staff_screening_status || "NOT_SCREENED",

    note: application.staff_screening_note || null,

    screenedByStaffId: staffId,

    screenedByStaffName: getStaffName(staffId, staffMap),

    screenedAt: application.screened_at || null,
  };
};

// ======================================================
// APPLICATION REVIEW SERIALIZER
//
// Historical field:
//
// admin_reviewed_by
//
// may actually contain:
//
// ADM-* => Admin
// STF-* => authorized Staff
//
// We keep `reviewedBy` for compatibility while adding:
//
// reviewedByType
// reviewedById
// reviewedByName
// ======================================================

const serializeAdminReview = (
  application,
  staffMap = new Map(),
  adminMap = new Map(),
) => {
  const reviewedBy = application.admin_reviewed_by || null;

  const reviewedByType = getActorTypeFromId(reviewedBy);

  const reviewedByName = getReviewActorName(reviewedBy, staffMap, adminMap);

  return {
    // Legacy compatibility
    reviewedBy,

    // New audit fields
    reviewedByType,

    reviewedById: reviewedBy,

    reviewedByName: reviewedByName || reviewedBy,

    reviewedAt: application.admin_reviewed_at || null,

    rejectionReason: application.admin_rejection_reason || null,
  };
};

// ======================================================
// FIND RELATED DATA
//
// In addition to Seeker/Vacancy/Provider, this also
// resolves:
//
// - Staff screening actor names
// - Staff approval/rejection actor names
// - Admin approval/rejection usernames
//
// This avoids N+1 actor queries for the application list.
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

  // ====================================================
  // STAFF IDS
  //
  // Includes:
  //
  // - Staff who screened
  // - Staff who approved/rejected
  // ====================================================

  const staffIds = [
    ...new Set(
      applications
        .flatMap((application) => {
          const ids = [];

          if (application.screened_by_staff_id) {
            ids.push(normalizeActorId(application.screened_by_staff_id));
          }

          if (getActorTypeFromId(application.admin_reviewed_by) === "staff") {
            ids.push(normalizeActorId(application.admin_reviewed_by));
          }

          return ids;
        })
        .filter(Boolean),
    ),
  ];

  // ====================================================
  // ADMIN IDS
  //
  // Admin reviewers only.
  // ====================================================

  const adminIds = [
    ...new Set(
      applications
        .map((application) =>
          getActorTypeFromId(application.admin_reviewed_by) === "admin"
            ? normalizeActorId(application.admin_reviewed_by)
            : null,
        )
        .filter(Boolean),
    ),
  ];

  const [seekers, vacancies, providers, staffs, admins] = await Promise.all([
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

    staffIds.length
      ? Staff.find({
          staffId: {
            $in: staffIds,
          },
        })
          .select("staffId name")
          .lean()
      : [],

    adminIds.length
      ? Admin.find({
          adminId: {
            $in: adminIds,
          },
        })
          .select("adminId username")
          .lean()
      : [],
  ]);

  // ====================================================
  // MAPS
  // ====================================================

  const seekerMap = new Map(
    seekers.map((seeker) => [seeker.seeker_id, seeker]),
  );

  const vacancyMap = new Map(
    vacancies.map((vacancy) => [vacancy.vacancyId, vacancy]),
  );

  const providerMap = new Map(
    providers.map((provider) => [provider.registerId, provider]),
  );

  const staffMap = new Map(
    staffs.map((staff) => [normalizeActorId(staff.staffId), staff]),
  );

  const adminMap = new Map(
    admins.map((admin) => [normalizeActorId(admin.adminId), admin]),
  );

  return {
    seekerMap,

    vacancyMap,

    providerMap,

    staffMap,

    adminMap,
  };
};

// ======================================================
// LIST SERIALIZER
// ======================================================

const toApplicationListItem = (
  application,
  seeker,
  vacancy,
  provider,
  staffMap,
  adminMap,
) => {
  return {
    applicationId: application.application_id,

    seekerId: application.seeker_id,

    vacancyId: application.vacancy_id,

    providerId: application.provider_id,

    status: application.status,

    appliedAt: application.applied_at,

    coverLetter: application.cover_letter || null,

    // ==================================================
    // CANDIDATE
    // ==================================================

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

    // ==================================================
    // VACANCY
    // ==================================================

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

    // ==================================================
    // PROVIDER
    // ==================================================

    provider: {
      registerId: provider?.registerId || application.provider_id,

      name: provider?.name || null,

      companyName: provider?.companyName || vacancy?.companyName || null,

      email: provider?.email || null,
    },

    // ==================================================
    // STAFF SCREENING
    // ==================================================

    staffScreening: serializeStaffScreening(application, staffMap),

    // ==================================================
    // APPLICATION REVIEW
    // ==================================================

    adminReview: serializeAdminReview(application, staffMap, adminMap),
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
//
// GET
// /api/admin/applications
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

    const { seekerMap, vacancyMap, providerMap, staffMap, adminMap } =
      await getRelatedData(applications);

    let data = applications.map((application) =>
      toApplicationListItem(
        application,

        seekerMap.get(application.seeker_id),

        vacancyMap.get(application.vacancy_id),

        providerMap.get(application.provider_id),

        staffMap,

        adminMap,
      ),
    );

    // ==================================================
    // SEARCH
    // ==================================================

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

          application.staffScreening.screenedByStaffName,

          application.staffScreening.note,

          application.adminReview.reviewedById,

          application.adminReview.reviewedByName,

          application.adminReview.reviewedByType,
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
//
// GET
// /api/admin/applications/:applicationId
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

    // ==================================================
    // LOAD ALL RELATED DATA
    //
    // This now includes Staff/Admin actor names.
    // ==================================================

    const { seekerMap, vacancyMap, providerMap, staffMap, adminMap } =
      await getRelatedData([application]);

    const seeker = seekerMap.get(application.seeker_id);

    const vacancy = vacancyMap.get(application.vacancy_id);

    const provider = providerMap.get(application.provider_id);

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

        // ============================================
        // CANDIDATE
        // ============================================

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

        // ============================================
        // VACANCY
        // ============================================

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

        // ============================================
        // PROVIDER
        // ============================================

        provider: {
          registerId: provider?.registerId || application.provider_id,

          name: provider?.name || null,

          companyName: provider?.companyName || vacancy?.companyName || null,

          email: provider?.email || null,
        },

        // ============================================
        // STAFF SCREENING
        // ============================================

        staffScreening: serializeStaffScreening(application, staffMap),

        // ============================================
        // REVIEW / APPROVAL
        // ============================================

        adminReview: serializeAdminReview(application, staffMap, adminMap),

        // ============================================
        // FROZEN APPLICATION RESUME
        // ============================================

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
//
// PATCH
// /api/admin/applications/:applicationId/approve
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

        message: "Only applications pending approval can be approved.",
      });
    }

    // ==================================================
    // ADMIN DECISION
    // ==================================================

    application.status = "SENT_TO_PROVIDER";

    application.admin_reviewed_at = new Date();

    application.admin_reviewed_by = req.admin.adminId;

    application.admin_rejection_reason = null;

    await application.save();

    // ==================================================
    // RESOLVE ADMIN USERNAME
    // ==================================================

    const admin = await Admin.findOne({
      adminId: req.admin.adminId,
    })
      .select("adminId username")
      .lean();

    return res.status(200).json({
      success: true,

      message: "Application approved and sent to Provider.",

      data: {
        applicationId: application.application_id,

        status: application.status,

        reviewedAt: application.admin_reviewed_at,

        // Legacy
        reviewedBy: application.admin_reviewed_by,

        reviewedByType: "admin",

        reviewedById: application.admin_reviewed_by,

        reviewedByName: admin?.username || application.admin_reviewed_by,

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
//
// PATCH
// /api/admin/applications/:applicationId/reject
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

        message: "Only applications pending approval can be rejected.",
      });
    }

    // ==================================================
    // ADMIN REJECTION
    // ==================================================

    application.status = "ADMIN_REJECTED";

    application.admin_reviewed_at = new Date();

    application.admin_reviewed_by = req.admin.adminId;

    application.admin_rejection_reason = reason;

    await application.save();

    // ==================================================
    // RESOLVE ADMIN USERNAME
    // ==================================================

    const admin = await Admin.findOne({
      adminId: req.admin.adminId,
    })
      .select("adminId username")
      .lean();

    return res.status(200).json({
      success: true,

      message: "Application rejected.",

      data: {
        applicationId: application.application_id,

        status: application.status,

        reviewedAt: application.admin_reviewed_at,

        // Legacy
        reviewedBy: application.admin_reviewed_by,

        reviewedByType: "admin",

        reviewedById: application.admin_reviewed_by,

        reviewedByName: admin?.username || application.admin_reviewed_by,

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
// GET
// /api/admin/applications/:applicationId/resume
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
