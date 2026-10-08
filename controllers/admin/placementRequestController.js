const Recruit = require("../../models/providers/recruitSchema");

const Register = require("../../models/providers/registerSchema");

const Staff = require("../../models/admin/staffSchema");

const Admin = require("../../models/admin/adminSchema");

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
// RESOLVE ACTOR NAME
// ======================================================

const resolveActorName = ({ role, actorId, staffMap, adminMap, snapshot }) => {
  if (snapshot) {
    return snapshot;
  }

  const normalizedId = normalizeActorId(actorId);

  if (!normalizedId) {
    return null;
  }

  if (role === "staff") {
    return staffMap.get(normalizedId)?.name || null;
  }

  if (role === "admin") {
    return adminMap.get(normalizedId)?.username || null;
  }

  return null;
};

// ======================================================
// BUILD ACTOR MAPS
// ======================================================

const getActorMaps = async (recruits) => {
  const staffIds = new Set();

  const adminIds = new Set();

  recruits.forEach((recruit) => {
    if (recruit.screened_by_staff_id) {
      staffIds.add(normalizeActorId(recruit.screened_by_staff_id));
    }

    if (recruit.reviewed_by_role === "staff" && recruit.reviewed_by_id) {
      staffIds.add(normalizeActorId(recruit.reviewed_by_id));
    }

    if (recruit.reviewed_by_role === "admin" && recruit.reviewed_by_id) {
      adminIds.add(normalizeActorId(recruit.reviewed_by_id));
    }

    const history = Array.isArray(recruit.workflow_history)
      ? recruit.workflow_history
      : [];

    history.forEach((item) => {
      if (item.actor_role === "staff" && item.actor_id) {
        staffIds.add(normalizeActorId(item.actor_id));
      }

      if (item.actor_role === "admin" && item.actor_id) {
        adminIds.add(normalizeActorId(item.actor_id));
      }
    });
  });

  const normalizedStaffIds = [...staffIds].filter(Boolean);

  const normalizedAdminIds = [...adminIds].filter(Boolean);

  const [staffs, admins] = await Promise.all([
    normalizedStaffIds.length
      ? Staff.find({
          staffId: {
            $in: normalizedStaffIds,
          },
        })
          .select("staffId name")
          .lean()
      : [],

    normalizedAdminIds.length
      ? Admin.find({
          adminId: {
            $in: normalizedAdminIds,
          },
        })
          .select("adminId username")
          .lean()
      : [],
  ]);

  return {
    staffMap: new Map(
      staffs.map((staff) => [normalizeActorId(staff.staffId), staff]),
    ),

    adminMap: new Map(
      admins.map((admin) => [normalizeActorId(admin.adminId), admin]),
    ),
  };
};

// ======================================================
// GET CURRENT ADMIN ACTOR
// ======================================================

const getCurrentAdminActor = async (adminId) => {
  if (!adminId) {
    return {
      id: null,
      name: "Admin",
    };
  }

  const admin = await Admin.findOne({
    adminId,
  })
    .select("adminId username")
    .lean();

  return {
    id: adminId,

    name: admin?.username || "Admin",
  };
};

// ======================================================
// STAFF SCREENING SERIALIZER
// ======================================================

const serializeStaffScreening = (recruit, staffMap = new Map()) => {
  const staffId = recruit.screened_by_staff_id || null;

  return {
    status: recruit.staff_screening_status || "NOT_SCREENED",

    note: recruit.staff_screening_note || null,

    screenedByStaffId: staffId,

    screenedByStaffName: staffId
      ? staffMap.get(normalizeActorId(staffId))?.name || null
      : null,

    screenedAt: recruit.screened_at || null,
  };
};

// ======================================================
// WORKFLOW HISTORY SERIALIZER
//
// Existing records created before this feature may not
// have workflow_history.
//
// For those records we create legacy display entries from
// the current screening/review fields.
//
// This does NOT invent older overwritten history.
// ======================================================

const serializeWorkflowHistory = (
  recruit,
  staffMap = new Map(),
  adminMap = new Map(),
) => {
  const persistedHistory = Array.isArray(recruit.workflow_history)
    ? recruit.workflow_history
    : [];

  const history = persistedHistory.map((item) => ({
    action: item.action,

    fromStatus: item.from_status || null,

    toStatus: item.to_status || null,

    actorRole: item.actor_role || null,

    actorId: item.actor_id || null,

    actorName: resolveActorName({
      role: item.actor_role,

      actorId: item.actor_id,

      staffMap,

      adminMap,

      snapshot: item.actor_name_snapshot,
    }),

    note: item.note || null,

    createdAt: item.created_at || null,
  }));

  const hasScreeningHistory = history.some((item) =>
    ["SCREENED", "NEEDS_ATTENTION"].includes(item.action),
  );

  if (
    !hasScreeningHistory &&
    recruit.screened_at &&
    recruit.staff_screening_status !== "NOT_SCREENED"
  ) {
    history.push({
      action: recruit.staff_screening_status,

      fromStatus: "pending_review",

      toStatus: "pending_review",

      actorRole: "staff",

      actorId: recruit.screened_by_staff_id || null,

      actorName: recruit.screened_by_staff_id
        ? staffMap.get(normalizeActorId(recruit.screened_by_staff_id))?.name ||
          null
        : null,

      note: recruit.staff_screening_note || null,

      createdAt: recruit.screened_at,
    });
  }

  const hasDecisionHistory = history.some((item) =>
    ["APPROVED", "REJECTED"].includes(item.action),
  );

  if (
    !hasDecisionHistory &&
    recruit.reviewed_at &&
    ["approved", "rejected"].includes(recruit.status)
  ) {
    history.push({
      action: recruit.status === "approved" ? "APPROVED" : "REJECTED",

      fromStatus: "pending_review",

      toStatus: recruit.status,

      actorRole: recruit.reviewed_by_role || null,

      actorId: recruit.reviewed_by_id || null,

      actorName: resolveActorName({
        role: recruit.reviewed_by_role,

        actorId: recruit.reviewed_by_id,

        staffMap,

        adminMap,
      }),

      note: recruit.rejection_reason || null,

      createdAt: recruit.reviewed_at,
    });
  }

  return history.sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;

    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;

    return bTime - aTime;
  });
};

// ======================================================
// REQUEST SERIALIZER
// ======================================================

const serializeRequest = (
  recruit,
  provider,
  staffMap = new Map(),
  adminMap = new Map(),
) => {
  const reviewedByName = resolveActorName({
    role: recruit.reviewed_by_role,

    actorId: recruit.reviewed_by_id,

    staffMap,

    adminMap,
  });

  return {
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

    reviewedByName,

    review: {
      decision: ["approved", "rejected"].includes(recruit.status)
        ? recruit.status
        : null,

      reviewedAt: recruit.reviewed_at || null,

      reviewedByRole: recruit.reviewed_by_role || null,

      reviewedById: recruit.reviewed_by_id || null,

      reviewedByName,

      rejectionReason: recruit.rejection_reason || null,
    },

    // ==================================================
    // STAFF SCREENING
    // ==================================================

    staffScreening: serializeStaffScreening(recruit, staffMap),

    // ==================================================
    // COMPLETE INTERNAL AUDIT HISTORY
    // ==================================================

    workflowHistory: serializeWorkflowHistory(recruit, staffMap, adminMap),

    createdAt: recruit.createdAt,

    updatedAt: recruit.updatedAt,
  };
};

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
      .select("+workflow_history")
      .sort({
        createdAt: -1,
      })
      .lean();

    const [providerMap, actorMaps] = await Promise.all([
      getProviderMap(recruits),

      getActorMaps(recruits),
    ]);

    const { staffMap, adminMap } = actorMaps;

    const data = recruits.map((recruit) =>
      serializeRequest(
        recruit,

        providerMap.get(recruit.company_id),

        staffMap,

        adminMap,
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
    })
      .select("+workflow_history")
      .lean();

    if (!recruit) {
      return res.status(404).json({
        success: false,

        message: "Placement request not found.",
      });
    }

    const [provider, actorMaps] = await Promise.all([
      getProvider(recruit.company_id),

      getActorMaps([recruit]),
    ]);

    return res.status(200).json({
      success: true,

      data: serializeRequest(
        recruit,

        provider,

        actorMaps.staffMap,

        actorMaps.adminMap,
      ),
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
    }).select("+workflow_history");

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

    const previousStatus = recruit.status;

    const now = new Date();

    const actor = await getCurrentAdminActor(req.admin.adminId);

    // ==================================================
    // SAVE HISTORY
    // ==================================================

    recruit.workflow_history.push({
      action: "APPROVED",

      from_status: previousStatus,

      to_status: "approved",

      actor_role: "admin",

      actor_id: actor.id,

      actor_name_snapshot: actor.name,

      note: null,

      created_at: now,
    });

    // ==================================================
    // CURRENT STATE
    // ==================================================

    recruit.status = "approved";

    recruit.reviewed_at = now;

    recruit.reviewed_by_role = "admin";

    recruit.reviewed_by_id = req.admin.adminId;

    recruit.rejection_reason = null;

    await recruit.save();

    const plainRecruit = recruit.toObject();

    const [provider, actorMaps] = await Promise.all([
      getProvider(recruit.company_id),

      getActorMaps([plainRecruit]),
    ]);

    return res.status(200).json({
      success: true,

      message: "Placement request approved.",

      data: serializeRequest(
        plainRecruit,

        provider,

        actorMaps.staffMap,

        actorMaps.adminMap,
      ),
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
    }).select("+workflow_history");

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

    const previousStatus = recruit.status;

    const now = new Date();

    const actor = await getCurrentAdminActor(req.admin.adminId);

    // ==================================================
    // SAVE HISTORY
    // ==================================================

    recruit.workflow_history.push({
      action: "REJECTED",

      from_status: previousStatus,

      to_status: "rejected",

      actor_role: "admin",

      actor_id: actor.id,

      actor_name_snapshot: actor.name,

      note: reason,

      created_at: now,
    });

    // ==================================================
    // CURRENT STATE
    // ==================================================

    recruit.status = "rejected";

    recruit.reviewed_at = now;

    recruit.reviewed_by_role = "admin";

    recruit.reviewed_by_id = req.admin.adminId;

    recruit.rejection_reason = reason;

    await recruit.save();

    const plainRecruit = recruit.toObject();

    const [provider, actorMaps] = await Promise.all([
      getProvider(recruit.company_id),

      getActorMaps([plainRecruit]),
    ]);

    return res.status(200).json({
      success: true,

      message: "Placement request rejected.",

      data: serializeRequest(
        plainRecruit,

        provider,

        actorMaps.staffMap,

        actorMaps.adminMap,
      ),
    });
  } catch (error) {
    console.error("REJECT PLACEMENT REQUEST ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to reject placement request.",
    });
  }
};
