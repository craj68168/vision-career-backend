const crypto = require("crypto");

const Recruit = require("../../models/providers/recruitSchema");

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
// CREATE
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
      data: recruit,
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
// ======================================================

exports.getAllRecruits = async (req, res) => {
  try {
    const data = await Recruit.find({
      company_id: req.registerId,
    }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load placement requests.",
    });
  }
};

// ======================================================
// GET ONE
// ======================================================

exports.getRecruitById = async (req, res) => {
  try {
    const data = await Recruit.findOne({
      recruitId: req.params.recruitId,
      company_id: req.registerId,
    });

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Placement request not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load placement request.",
    });
  }
};

// ======================================================
// UPDATE
// PUT /api/providers/recruits/:recruitId
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

    // Editing rejected request prepares it
    // for resubmission.
    if (recruit.status === "rejected") {
      recruit.rejection_reason = null;
      recruit.reviewed_at = null;
    }

    await recruit.save();

    return res.status(200).json({
      success: true,
      message: "Placement request updated.",
      data: recruit,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update placement request.",
    });
  }
};

// ======================================================
// SUBMIT / RESUBMIT
// PATCH /api/providers/recruits/:recruitId/submit
// ======================================================

exports.submitRecruit = async (req, res) => {
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
        message: "This placement request cannot be submitted.",
      });
    }

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

    recruit.status = "pending_review";

    recruit.submitted_at = new Date();

    recruit.reviewed_at = null;
    recruit.rejection_reason = null;

    await recruit.save();

    return res.status(200).json({
      success: true,
      message: "Placement request submitted for Admin review.",
      data: recruit,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to submit placement request.",
    });
  }
};

// ======================================================
// DELETE
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
    return res.status(500).json({
      success: false,
      message: "Failed to delete placement request.",
    });
  }
};
