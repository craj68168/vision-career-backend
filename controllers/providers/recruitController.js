const crypto = require("crypto");

const Recruit = require("../../models/providers/recruitSchema");

const Register = require("../../models/providers/registerSchema");

// ======================================================
// GENERATE ID
// ======================================================

const generateRecruitId = async () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const id = `R-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    const exists = await Recruit.exists({
      recruitId: id,
    });

    if (!exists) {
      return id;
    }
  }

  throw new Error("Unable to generate placement request ID.");
};

// ======================================================
// EDITABLE FIELDS
// ======================================================

const EDITABLE_FIELDS = [
  "job_title",
  "job_category",
  "employment_type",
  "number_of_positions",
  "work_location",
  "job_description",
  "requirements",
  "japanese_level_required",
  "visa_type_required",
  "salary_type",
  "salary_amount",
  "working_hours",
  "days_off",
  "start_date",
];

// ======================================================
// PROVIDER-SAFE SERIALIZER
//
// IMPORTANT:
//
// Provider must NOT receive internal Vision Career
// audit information.
//
// Never expose:
//
// - workflow_history
// - reviewed_by_role
// - reviewed_by_id
// - staff_screening_status
// - staff_screening_note
// - screened_by_staff_id
// - screened_at
//
// Provider MAY see:
//
// - current status
// - rejection reason
// - reviewed timestamp
//
// because they need those to understand their request
// workflow.
//
// ======================================================

const serializeProviderRecruit = (recruit) => {
  if (!recruit) {
    return null;
  }

  const raw =
    typeof recruit.toObject === "function"
      ? recruit.toObject()
      : { ...recruit };

  return {
    _id: raw._id,

    recruitId: raw.recruitId,

    company_id: raw.company_id,

    // ==================================================
    // JOB
    // ==================================================

    job_title: raw.job_title,

    job_category: raw.job_category,

    employment_type: raw.employment_type,

    number_of_positions: raw.number_of_positions,

    work_location: raw.work_location,

    job_description: raw.job_description,

    requirements: raw.requirements,

    japanese_level_required: raw.japanese_level_required,

    visa_type_required: raw.visa_type_required,

    // ==================================================
    // CONDITIONS
    // ==================================================

    salary_type: raw.salary_type,

    salary_amount: raw.salary_amount,

    working_hours: raw.working_hours,

    days_off: raw.days_off,

    start_date: raw.start_date,

    // ==================================================
    // PROVIDER-VISIBLE WORKFLOW
    // ==================================================

    status: raw.status,

    submitted_at: raw.submitted_at,

    reviewed_at: raw.reviewed_at,

    rejection_reason: raw.rejection_reason,

    // ==================================================
    // TIMESTAMPS
    // ==================================================

    createdAt: raw.createdAt,

    updatedAt: raw.updatedAt,
  };
};

// ======================================================
// CURRENT PROVIDER ACTOR
//
// Used only when writing internal audit history.
//
// The Provider still does NOT receive that history.
// ======================================================

const getCurrentProviderActor = async (registerId) => {
  if (!registerId) {
    return {
      id: null,
      name: "Provider",
    };
  }

  const provider = await Register.findOne({
    registerId,

    role: "provider",
  })
    .select("registerId name companyName")
    .lean();

  return {
    id: registerId,

    name: provider?.name || provider?.companyName || "Provider",
  };
};

// ======================================================
// CREATE
//
// POST /api/providers/recruits
// ======================================================

exports.createRecruit = async (req, res) => {
  try {
    const companyId = req.registerId;

    const recruitId = await generateRecruitId();

    const payload = {};

    EDITABLE_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) {
        payload[field] = req.body[field];
      }
    });

    const recruit = await Recruit.create({
      ...payload,

      recruitId,

      company_id: companyId,

      status: "draft",
    });

    return res.status(201).json({
      success: true,

      message: "Placement request created as draft.",

      data: serializeProviderRecruit(recruit),
    });
  } catch (error) {
    console.error("CREATE PLACEMENT REQUEST ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to create placement request.",
    });
  }
};

// ======================================================
// GET ALL
//
// GET /api/providers/recruits
//
// workflow_history has select:false in the model,
// but we also serialize explicitly so internal fields
// cannot accidentally leak.
//
// ======================================================

exports.getAllRecruits = async (req, res) => {
  try {
    const recruits = await Recruit.find({
      company_id: req.registerId,
    })
      .sort({
        createdAt: -1,
      })
      .lean();

    const data = recruits.map(serializeProviderRecruit);

    return res.status(200).json({
      success: true,

      count: data.length,

      data,
    });
  } catch (error) {
    console.error("GET PROVIDER PLACEMENT REQUESTS ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load placement requests.",
    });
  }
};

// ======================================================
// GET ONE
//
// GET /api/providers/recruits/:recruitId
// ======================================================

exports.getRecruitById = async (req, res) => {
  try {
    const recruit = await Recruit.findOne({
      recruitId: req.params.recruitId,

      company_id: req.registerId,
    }).lean();

    if (!recruit) {
      return res.status(404).json({
        success: false,

        message: "Placement request not found.",
      });
    }

    return res.status(200).json({
      success: true,

      data: serializeProviderRecruit(recruit),
    });
  } catch (error) {
    console.error("GET PROVIDER PLACEMENT REQUEST ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load placement request.",
    });
  }
};

// ======================================================
// UPDATE
//
// PUT /api/providers/recruits/:recruitId
//
// Allowed:
//
// draft
// rejected
//
// IMPORTANT:
//
// Editing a rejected request DOES NOT erase the previous
// rejection decision.
//
// The request remains rejected until the Provider clicks
// Resubmit.
//
// That preserves:
//
// - rejection_reason
// - reviewed_at
// - reviewed_by_role
// - reviewed_by_id
//
// until actual resubmission.
//
// ======================================================

exports.updateRecruit = async (req, res) => {
  try {
    const recruit = await Recruit.findOne({
      recruitId: req.params.recruitId,

      company_id: req.registerId,
    });

    if (!recruit) {
      return res.status(404).json({
        success: false,

        message: "Placement request not found.",
      });
    }

    if (!["draft", "rejected"].includes(recruit.status)) {
      return res.status(409).json({
        success: false,

        message: "Only draft or rejected placement requests can be edited.",
      });
    }

    EDITABLE_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) {
        recruit[field] = req.body[field];
      }
    });

    // ==================================================
    // DO NOT CLEAR REJECTION AUDIT HERE
    //
    // A rejected request is still rejected while the
    // Provider is editing it.
    //
    // We only clear the CURRENT review state when the
    // Provider actually resubmits.
    //
    // Historical audit entries remain permanently.
    // ==================================================

    await recruit.save();

    return res.status(200).json({
      success: true,

      message:
        recruit.status === "rejected"
          ? "Placement request updated. Resubmit it when the changes are ready for review."
          : "Placement request updated.",

      data: serializeProviderRecruit(recruit),
    });
  } catch (error) {
    console.error("UPDATE PLACEMENT REQUEST ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to update placement request.",
    });
  }
};

// ======================================================
// SUBMIT / RESUBMIT
//
// PATCH /api/providers/recruits/:recruitId/submit
//
// draft:
//   draft -> pending_review
//
// rejected:
//   rejected -> pending_review
//   + RESUBMITTED audit entry
//
// ======================================================

exports.submitRecruit = async (req, res) => {
  try {
    // ==================================================
    // IMPORTANT:
    //
    // workflow_history is select:false in the schema.
    //
    // We explicitly select it here because this operation
    // needs to APPEND the RESUBMITTED audit event.
    //
    // We still use serializeProviderRecruit() in the
    // response, so the Provider never receives it.
    // ==================================================

    const recruit = await Recruit.findOne({
      recruitId: req.params.recruitId,

      company_id: req.registerId,
    }).select("+workflow_history");

    if (!recruit) {
      return res.status(404).json({
        success: false,

        message: "Placement request not found.",
      });
    }

    if (!["draft", "rejected"].includes(recruit.status)) {
      return res.status(409).json({
        success: false,

        message: "This placement request cannot be submitted.",
      });
    }

    // ==================================================
    // VALIDATION
    // ==================================================

    if (
      !recruit.job_title ||
      !recruit.work_location ||
      !recruit.job_description ||
      !recruit.number_of_positions
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Job title, work location, job description and number of positions are required before submission.",
      });
    }

    // ==================================================
    // DETERMINE SUBMISSION TYPE
    // ==================================================

    const previousStatus = recruit.status;

    const isResubmission = previousStatus === "rejected";

    const now = new Date();

    // ==================================================
    // RESUBMISSION AUDIT
    //
    // Do this BEFORE clearing current rejection fields.
    // ==================================================

    if (isResubmission) {
      const actor = await getCurrentProviderActor(req.registerId);

      if (!Array.isArray(recruit.workflow_history)) {
        recruit.workflow_history = [];
      }

      recruit.workflow_history.push({
        action: "RESUBMITTED",

        from_status: "rejected",

        to_status: "pending_review",

        actor_role: "provider",

        actor_id: actor.id,

        actor_name_snapshot: actor.name,

        note: null,

        created_at: now,
      });
    }

    // ==================================================
    // CURRENT WORKFLOW STATE
    // ==================================================

    recruit.status = "pending_review";

    recruit.submitted_at = now;

    // ==================================================
    // CLEAR CURRENT FINAL DECISION
    //
    // Old decision remains permanently inside
    // workflow_history.
    // ==================================================

    recruit.reviewed_at = null;

    recruit.reviewed_by_role = null;

    recruit.reviewed_by_id = null;

    recruit.rejection_reason = null;

    // ==================================================
    // RESET CURRENT STAFF SCREENING
    //
    // Previous screening remains in workflow_history.
    //
    // The modified/resubmitted request must be screened
    // again as a new review cycle.
    // ==================================================

    recruit.staff_screening_status = "NOT_SCREENED";

    recruit.staff_screening_note = null;

    recruit.screened_by_staff_id = null;

    recruit.screened_at = null;

    await recruit.save();

    return res.status(200).json({
      success: true,

      message: isResubmission
        ? "Placement request resubmitted for review."
        : "Placement request submitted for review.",

      data: serializeProviderRecruit(recruit),
    });
  } catch (error) {
    console.error("SUBMIT PLACEMENT REQUEST ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to submit placement request.",
    });
  }
};

// ======================================================
// DELETE
//
// Existing behavior retained:
//
// draft / rejected only
//
// ======================================================

exports.deleteRecruit = async (req, res) => {
  try {
    const recruit = await Recruit.findOne({
      recruitId: req.params.recruitId,

      company_id: req.registerId,
    });

    if (!recruit) {
      return res.status(404).json({
        success: false,

        message: "Placement request not found.",
      });
    }

    if (!["draft", "rejected"].includes(recruit.status)) {
      return res.status(409).json({
        success: false,

        message: "Only draft or rejected placement requests can be deleted.",
      });
    }

    await recruit.deleteOne();

    return res.status(200).json({
      success: true,

      message: "Placement request deleted.",
    });
  } catch (error) {
    console.error("DELETE PLACEMENT REQUEST ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to delete placement request.",
    });
  }
};
