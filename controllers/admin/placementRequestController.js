const Recruit = require("../../models/providers/recruitSchema");

const Register = require("../../models/providers/registerSchema");

// ======================================================
// STAFF SCREENING SERIALIZER
// ======================================================

const serializeStaffScreening = (recruit) => ({
  status: recruit.staff_screening_status || "NOT_SCREENED",

  note: recruit.staff_screening_note || null,

  screenedByStaffId: recruit.screened_by_staff_id || null,

  screenedAt: recruit.screened_at || null,
});

// ======================================================
// REQUEST SERIALIZER
// ======================================================

const serializeRequest = (recruit, provider) => ({
  recruitId: recruit.recruitId,

  companyId: recruit.company_id,

  companyName: provider?.companyName || "-",

  providerName: provider?.name || "-",

  providerEmail: provider?.email || null,

  // ==================================================
  // JOB
  // ==================================================

  jobTitle: recruit.job_title,

  jobCategory: recruit.job_category,

  employmentType: recruit.employment_type,

  numberOfPositions: recruit.number_of_positions,

  workLocation: recruit.work_location,

  jobDescription: recruit.job_description,

  requirements: recruit.requirements,

  japaneseLevelRequired: recruit.japanese_level_required,

  visaTypeRequired: recruit.visa_type_required,

  // ==================================================
  // CONDITIONS
  // ==================================================

  salaryType: recruit.salary_type,

  salaryAmount: recruit.salary_amount,

  workingHours: recruit.working_hours,

  daysOff: recruit.days_off,

  startDate: recruit.start_date,

  // ==================================================
  // WORKFLOW
  // ==================================================

  status: recruit.status,

  rejectionReason: recruit.rejection_reason,

  submittedAt: recruit.submitted_at,

  reviewedAt: recruit.reviewed_at,

  reviewedByRole: recruit.reviewed_by_role || null,

  reviewedById: recruit.reviewed_by_id || null,

  // ==================================================
  // STAFF SCREENING
  // ==================================================

  staffScreening: serializeStaffScreening(recruit),

  createdAt: recruit.createdAt,

  updatedAt: recruit.updatedAt,
});

// ======================================================
// PROVIDER MAP
// ======================================================

const getProviderMap = async (recruits) => {
  const companyIds = [
    ...new Set(recruits.map((item) => item.company_id).filter(Boolean)),
  ];

  if (companyIds.length === 0) {
    return new Map();
  }

  const providers = await Register.find({
    registerId: {
      $in: companyIds,
    },

    role: "provider",
  }).lean();

  return new Map(providers.map((provider) => [provider.registerId, provider]));
};

// ======================================================
// GET PROVIDER
// ======================================================

const getProvider = async (companyId) => {
  return Register.findOne({
    registerId: companyId,

    role: "provider",
  }).lean();
};

// ======================================================
// GET ALL
// ======================================================

exports.getPlacementRequests = async (req, res) => {
  try {
    const recruits = await Recruit.find({
      status: {
        $ne: "draft",
      },
    })
      .sort({
        createdAt: -1,
      })
      .lean();

    const providerMap = await getProviderMap(recruits);

    const data = recruits.map((recruit) =>
      serializeRequest(
        recruit,

        providerMap.get(recruit.company_id),
      ),
    );

    return res.status(200).json({
      success: true,

      count: data.length,

      summary: {
        total: data.length,

        pendingReview: data.filter((item) => item.status === "pending_review")
          .length,

        approved: data.filter((item) => item.status === "approved").length,

        rejected: data.filter((item) => item.status === "rejected").length,

        // Screening summary is independent from
        // workflow status.

        notScreened: data.filter(
          (item) => item.staffScreening.status === "NOT_SCREENED",
        ).length,

        screened: data.filter(
          (item) => item.staffScreening.status === "SCREENED",
        ).length,

        needsAttention: data.filter(
          (item) => item.staffScreening.status === "NEEDS_ATTENTION",
        ).length,
      },

      data,
    });
  } catch (error) {
    console.error("GET ADMIN PLACEMENT REQUESTS ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load placement requests.",
    });
  }
};

// ======================================================
// GET ONE
// ======================================================

exports.getPlacementRequestById = async (req, res) => {
  try {
    const recruit = await Recruit.findOne({
      recruitId: req.params.recruitId,
    }).lean();

    if (!recruit) {
      return res.status(404).json({
        success: false,

        message: "Placement request not found.",
      });
    }

    const provider = await getProvider(recruit.company_id);

    return res.status(200).json({
      success: true,

      data: serializeRequest(recruit, provider),
    });
  } catch (error) {
    console.error("GET ADMIN PLACEMENT REQUEST ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load placement request.",
    });
  }
};

// ======================================================
// APPROVE
//
// pending_review -> approved
// ======================================================

exports.approvePlacementRequest = async (req, res) => {
  try {
    const recruit = await Recruit.findOne({
      recruitId: req.params.recruitId,
    });

    if (!recruit) {
      return res.status(404).json({
        success: false,

        message: "Placement request not found.",
      });
    }

    if (recruit.status !== "pending_review") {
      return res.status(409).json({
        success: false,

        message: "Only pending placement requests can be approved.",
      });
    }

    recruit.status = "approved";

    recruit.reviewed_at = new Date();

    recruit.reviewed_by_role = "admin";

    recruit.reviewed_by_id = req.admin.adminId;

    recruit.rejection_reason = null;

    await recruit.save();

    const provider = await getProvider(recruit.company_id);

    return res.status(200).json({
      success: true,

      message: "Placement request approved.",

      data: serializeRequest(recruit, provider),
    });
  } catch (error) {
    console.error("APPROVE PLACEMENT REQUEST ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to approve placement request.",
    });
  }
};

// ======================================================
// REJECT
//
// pending_review -> rejected
// ======================================================

exports.rejectPlacementRequest = async (req, res) => {
  try {
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

    const recruit = await Recruit.findOne({
      recruitId: req.params.recruitId,
    });

    if (!recruit) {
      return res.status(404).json({
        success: false,

        message: "Placement request not found.",
      });
    }

    if (recruit.status !== "pending_review") {
      return res.status(409).json({
        success: false,

        message: "Only pending placement requests can be rejected.",
      });
    }

    recruit.status = "rejected";

    recruit.reviewed_at = new Date();

    recruit.reviewed_by_role = "admin";

    recruit.reviewed_by_id = req.admin.adminId;

    recruit.rejection_reason = reason;

    await recruit.save();

    const provider = await getProvider(recruit.company_id);

    return res.status(200).json({
      success: true,

      message: "Placement request rejected.",

      data: serializeRequest(recruit, provider),
    });
  } catch (error) {
    console.error("REJECT PLACEMENT REQUEST ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to reject placement request.",
    });
  }
};
