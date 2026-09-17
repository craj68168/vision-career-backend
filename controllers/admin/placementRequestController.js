const Recruit = require("../../models/providers/recruitSchema");

const Register = require("../../models/providers/registerSchema");

// ======================================================
// SERIALIZER
// ======================================================

const serializeRequest = (recruit, provider) => ({
  recruitId: recruit.recruitId,

  companyId: recruit.company_id,

  companyName: provider?.companyName || "-",

  providerName: provider?.name || "-",

  providerEmail: provider?.email || null,

  jobTitle: recruit.job_title,

  jobCategory: recruit.job_category,

  employmentType: recruit.employment_type,

  numberOfPositions: recruit.number_of_positions,

  workLocation: recruit.work_location,

  jobDescription: recruit.job_description,

  requirements: recruit.requirements,

  japaneseLevelRequired: recruit.japanese_level_required,

  visaTypeRequired: recruit.visa_type_required,

  salaryType: recruit.salary_type,

  salaryAmount: recruit.salary_amount,

  workingHours: recruit.working_hours,

  daysOff: recruit.days_off,

  startDate: recruit.start_date,

  status: recruit.status,

  rejectionReason: recruit.rejection_reason,

  submittedAt: recruit.submitted_at,

  reviewedAt: recruit.reviewed_at,

  createdAt: recruit.createdAt,

  updatedAt: recruit.updatedAt,
});

// ======================================================
// GET ALL
// GET /api/admin/placement-requests
// ======================================================

exports.getPlacementRequests = async (req, res) => {
  try {
    const recruits = await Recruit.find({
      status: {
        $ne: "draft",
      },
    }).sort({
      createdAt: -1,
    });

    const companyIds = [...new Set(recruits.map((item) => item.company_id))];

    const providers = await Register.find({
      registerId: {
        $in: companyIds,
      },

      role: "provider",
    }).lean();

    const providerMap = new Map(
      providers.map((provider) => [provider.registerId, provider]),
    );

    const data = recruits.map((recruit) =>
      serializeRequest(recruit, providerMap.get(recruit.company_id)),
    );

    return res.status(200).json({
      success: true,

      count: data.length,

      summary: {
        total: data.length,

        draft: data.filter((item) => item.status === "draft").length,

        pendingReview: data.filter((item) => item.status === "pending_review")
          .length,

        approved: data.filter((item) => item.status === "approved").length,

        rejected: data.filter((item) => item.status === "rejected").length,
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
    });

    if (!recruit) {
      return res.status(404).json({
        success: false,
        message: "Placement request not found.",
      });
    }

    const provider = await Register.findOne({
      registerId: recruit.company_id,
      role: "provider",
    }).lean();

    return res.status(200).json({
      success: true,

      data: serializeRequest(recruit, provider),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load placement request.",
    });
  }
};

// ======================================================
// APPROVE
//
// pending_review → approved
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

    recruit.rejection_reason = null;

    await recruit.save();

    return res.status(200).json({
      success: true,

      message: "Placement request approved.",

      data: recruit,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to approve placement request.",
    });
  }
};

// ======================================================
// REJECT
//
// pending_review → rejected
// ======================================================

exports.rejectPlacementRequest = async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required.",
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

    recruit.rejection_reason = String(reason).trim();

    await recruit.save();

    return res.status(200).json({
      success: true,

      message: "Placement request rejected.",

      data: recruit,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to reject placement request.",
    });
  }
};
