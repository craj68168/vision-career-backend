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
// GET STAFF PLACEMENT REQUESTS
//
// GET /api/staff/placement-requests
//
// Draft requests are hidden because they have not been
// submitted by the Provider yet.
// ======================================================

exports.getStaffPlacementRequests = async (req, res) => {
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

        notScreened: data.filter(
          (item) =>
            item.status === "pending_review" &&
            item.staffScreening.status === "NOT_SCREENED",
        ).length,

        screened: data.filter(
          (item) => item.staffScreening.status === "SCREENED",
        ).length,

        needsAttention: data.filter(
          (item) => item.staffScreening.status === "NEEDS_ATTENTION",
        ).length,

        approved: data.filter((item) => item.status === "approved").length,

        rejected: data.filter((item) => item.status === "rejected").length,
      },

      data,
    });
  } catch (error) {
    console.error("GET STAFF PLACEMENT REQUESTS ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load placement requests.",
    });
  }
};

// ======================================================
// GET ONE
//
// GET
// /api/staff/placement-requests/:recruitId
// ======================================================

exports.getStaffPlacementRequestById = async (req, res) => {
  try {
    const recruit = await Recruit.findOne({
      recruitId: req.params.recruitId,

      status: {
        $ne: "draft",
      },
    }).lean();

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
    console.error("GET STAFF PLACEMENT REQUEST ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load placement request.",
    });
  }
};

// ======================================================
// SCREEN PLACEMENT REQUEST
//
// PATCH
// /api/staff/placement-requests/:recruitId/screen
//
// Staff may only screen requests currently waiting for
// Admin review.
//
// Staff DOES NOT change recruit.status.
// ======================================================

exports.screenStaffPlacementRequest = async (req, res) => {
  try {
    const { recruitId } = req.params;

    const { screeningStatus, note } = req.body;

    // ==================================================
    // VALIDATE STATUS
    // ==================================================

    if (!["SCREENED", "NEEDS_ATTENTION"].includes(screeningStatus)) {
      return res.status(400).json({
        success: false,

        message: "Invalid screening status.",
      });
    }

    const normalizedNote = typeof note === "string" ? note.trim() : "";

    // ==================================================
    // NEEDS ATTENTION REQUIRES NOTE
    // ==================================================

    if (screeningStatus === "NEEDS_ATTENTION" && !normalizedNote) {
      return res.status(400).json({
        success: false,

        message:
          "A screening note is required when marking a placement request as needing attention.",
      });
    }

    if (normalizedNote.length > 2000) {
      return res.status(400).json({
        success: false,

        message: "Screening note cannot exceed 2000 characters.",
      });
    }

    // ==================================================
    // FIND REQUEST
    // ==================================================

    const recruit = await Recruit.findOne({
      recruitId,
    });

    if (!recruit) {
      return res.status(404).json({
        success: false,

        message: "Placement request not found.",
      });
    }

    // ==================================================
    // MUST STILL BE PENDING
    // ==================================================

    if (recruit.status !== "pending_review") {
      return res.status(409).json({
        success: false,

        message:
          "Only placement requests waiting for Admin review can be screened.",
      });
    }

    // ==================================================
    // SAVE STAFF SCREENING
    // ==================================================

    recruit.staff_screening_status = screeningStatus;

    recruit.staff_screening_note = normalizedNote || null;

    recruit.screened_by_staff_id = req.staff.staffId;

    recruit.screened_at = new Date();

    await recruit.save();

    // ==================================================
    // PROVIDER
    // ==================================================

    const provider = await Register.findOne({
      registerId: recruit.company_id,

      role: "provider",
    }).lean();

    return res.status(200).json({
      success: true,

      message:
        screeningStatus === "SCREENED"
          ? "Placement request screening completed."
          : "Placement request marked as needing Admin attention.",

      data: serializeRequest(recruit, provider),
    });
  } catch (error) {
    console.error("SCREEN STAFF PLACEMENT REQUEST ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to screen placement request.",
    });
  }
};
