const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const Seeker = require("../../models/seekers/seekerSchema");
const Application = require("../../models/applications/applicationSchema");

// ======================================================
// CONSTANTS
// ======================================================

const APPROVAL_STATUSES = ["pending", "approved", "rejected"];

const ACCOUNT_STATUSES = ["inactive", "active", "suspended"];

const PLACEMENT_STATUSES = [
  "unplaced",
  "matching",
  "interview",
  "selected",
  "placed",
];

// ======================================================
// ESCAPE REGEX
// ======================================================

const escapeRegex = (value = "") => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// ======================================================
// GENERATE UNIQUE SEEKER ID
// ======================================================

const generateUniqueSeekerId = async () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const seekerId = `SKR-${crypto
      .randomBytes(4)
      .toString("hex")
      .toUpperCase()}`;

    const exists = await Seeker.exists({
      seeker_id: seekerId,
    });

    if (!exists) {
      return seekerId;
    }
  }

  throw new Error("Unable to generate unique seeker ID.");
};

// ======================================================
// DELETE FILE
// ======================================================

const deleteStoredFile = (fileUrl) => {
  if (!fileUrl) return;

  try {
    const fileName = path.basename(fileUrl);

    const filePath = path.join(__dirname, "../../uploads", fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error("Failed to delete seeker file:", error);
  }
};

// ======================================================
// ADMIN SEEKER RESPONSE
// ======================================================

const serializeSeeker = (seeker, applicationsCount = 0) => {
  const item =
    typeof seeker.toObject === "function" ? seeker.toObject() : seeker;

  delete item.password;
  delete item.password_reset_code_hash;
  delete item.password_reset_code_expires;
  delete item.password_reset_attempts;
  delete item.password_reset_token_hash;
  delete item.password_reset_token_expires;
  delete item.__v;

  return {
    ...item,
    applications_count: applicationsCount,
  };
};

// ======================================================
// GET ALL SEEKERS
//
// GET /api/admin/seekers
//
// Query:
// search
// approvalStatus
// accountStatus
// placementStatus
// page
// limit
// ======================================================

exports.getSeekers = async (req, res) => {
  try {
    const {
      search = "",
      approvalStatus = "",
      accountStatus = "",
      placementStatus = "",
      page = "1",
      limit = "20",
    } = req.query;

    const currentPage = Math.max(Number.parseInt(page, 10) || 1, 1);

    const pageLimit = Math.min(
      Math.max(Number.parseInt(limit, 10) || 20, 1),
      100,
    );

    const filter = {};

    // ==================================================
    // SEARCH
    // ==================================================

    if (search.trim()) {
      const escapedSearch = escapeRegex(search.trim());

      const regex = new RegExp(escapedSearch, "i");

      filter.$or = [
        {
          seeker_id: regex,
        },
        {
          name: regex,
        },
        {
          email: regex,
        },
        {
          phone: regex,
        },
        {
          current_location: regex,
        },
        {
          desired_job: regex,
        },
      ];
    }

    // ==================================================
    // APPROVAL FILTER
    // ==================================================

    if (approvalStatus && APPROVAL_STATUSES.includes(approvalStatus)) {
      filter.approval_status = approvalStatus;
    }

    // ==================================================
    // ACCOUNT FILTER
    // ==================================================

    if (accountStatus && ACCOUNT_STATUSES.includes(accountStatus)) {
      filter.account_status = accountStatus;
    }

    // ==================================================
    // PLACEMENT FILTER
    // ==================================================

    if (placementStatus && PLACEMENT_STATUSES.includes(placementStatus)) {
      filter.placement_status = placementStatus;
    }

    // ==================================================
    // QUERY
    // ==================================================

    const [
      seekers,
      filteredCount,

      total,
      active,
      inactive,
      suspended,

      pendingApproval,
      approved,
      rejected,
    ] = await Promise.all([
      Seeker.find(filter)
        .sort({
          created_at: -1,
        })
        .skip((currentPage - 1) * pageLimit)
        .limit(pageLimit),

      Seeker.countDocuments(filter),

      Seeker.countDocuments(),

      Seeker.countDocuments({
        account_status: "active",
      }),

      Seeker.countDocuments({
        account_status: "inactive",
      }),

      Seeker.countDocuments({
        account_status: "suspended",
      }),

      Seeker.countDocuments({
        approval_status: "pending",
      }),

      Seeker.countDocuments({
        approval_status: "approved",
      }),

      Seeker.countDocuments({
        approval_status: "rejected",
      }),
    ]);

    // ==================================================
    // APPLICATION COUNTS
    // ==================================================

    const seekerIds = seekers.map((seeker) => seeker.seeker_id);

    let applicationCountMap = {};

    if (seekerIds.length > 0) {
      const counts = await Application.aggregate([
        {
          $match: {
            seeker_id: {
              $in: seekerIds,
            },
          },
        },
        {
          $group: {
            _id: "$seeker_id",
            count: {
              $sum: 1,
            },
          },
        },
      ]);

      applicationCountMap = counts.reduce((accumulator, item) => {
        accumulator[item._id] = item.count;

        return accumulator;
      }, {});
    }

    const data = seekers.map((seeker) =>
      serializeSeeker(seeker, applicationCountMap[seeker.seeker_id] || 0),
    );

    const pages = Math.max(Math.ceil(filteredCount / pageLimit), 1);

    return res.status(200).json({
      success: true,

      summary: {
        total,
        active,
        inactive,
        suspended,

        approval: {
          pending: pendingApproval,
          approved,
          rejected,
        },
      },

      pagination: {
        page: currentPage,
        limit: pageLimit,
        total: filteredCount,
        pages,
      },

      data,
    });
  } catch (error) {
    console.error("GET ADMIN SEEKERS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load job seekers.",
    });
  }
};

// ======================================================
// GET ONE SEEKER
//
// GET /api/admin/seekers/:seekerId
// ======================================================

exports.getSeekerById = async (req, res) => {
  try {
    const { seekerId } = req.params;

    const seeker = await Seeker.findOne({
      seeker_id: seekerId,
    });

    if (!seeker) {
      return res.status(404).json({
        success: false,
        message: "Job seeker not found.",
      });
    }

    const applicationsCount = await Application.countDocuments({
      seeker_id: seekerId,
    });

    return res.status(200).json({
      success: true,

      data: serializeSeeker(seeker, applicationsCount),
    });
  } catch (error) {
    console.error("GET ADMIN SEEKER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load job seeker details.",
    });
  }
};

// ======================================================
// CREATE SEEKER BY ADMIN
//
// POST /api/admin/seekers
// ======================================================

exports.createSeeker = async (req, res) => {
  try {
    const {
      name,
      email,
      password,

      phone = null,
      current_location = null,
      nationality = null,

      approval_status = "approved",
      account_status = "active",
      placement_status = "unplaced",
    } = req.body;

    // ==================================================
    // REQUIRED
    // ==================================================

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    const existing = await Seeker.findOne({
      email: normalizedEmail,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "A job seeker with this email already exists.",
      });
    }

    if (!APPROVAL_STATUSES.includes(approval_status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid approval status.",
      });
    }

    if (!ACCOUNT_STATUSES.includes(account_status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid account status.",
      });
    }

    if (!PLACEMENT_STATUSES.includes(placement_status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid placement status.",
      });
    }

    // ==================================================
    // CONSISTENCY
    // ==================================================

    let finalAccountStatus = account_status;

    if (approval_status !== "approved") {
      finalAccountStatus = "inactive";
    }

    // ==================================================
    // PASSWORD
    // ==================================================

    const salt = await bcrypt.genSalt(12);

    const hashedPassword = await bcrypt.hash(password, salt);

    const seekerId = await generateUniqueSeekerId();

    // ==================================================
    // CREATE
    // ==================================================

    const seeker = await Seeker.create({
      seeker_id: seekerId,

      name: name.trim(),

      email: normalizedEmail,

      password: hashedPassword,

      phone: typeof phone === "string" ? phone.trim() || null : null,

      current_location:
        typeof current_location === "string"
          ? current_location.trim() || null
          : null,

      nationality:
        typeof nationality === "string" ? nationality.trim() || null : null,

      approval_status,

      account_status: finalAccountStatus,

      approval_reviewed_at: approval_status === "pending" ? null : new Date(),

      rejection_reason: null,

      placement_status,
    });

    return res.status(201).json({
      success: true,

      message: "Job seeker created successfully.",

      data: serializeSeeker(seeker, 0),
    });
  } catch (error) {
    console.error("CREATE ADMIN SEEKER ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email or seeker ID already exists.",
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
      message: "Failed to create job seeker.",
    });
  }
};

// ======================================================
// UPDATE SEEKER PROFILE
//
// PATCH /api/admin/seekers/:seekerId
//
// DOES NOT directly change:
// approval_status
// account_status
// placement_status
//
// Those use dedicated endpoints.
// ======================================================

exports.updateSeeker = async (req, res) => {
  try {
    const { seekerId } = req.params;

    const seeker = await Seeker.findOne({
      seeker_id: seekerId,
    });

    if (!seeker) {
      return res.status(404).json({
        success: false,
        message: "Job seeker not found.",
      });
    }

    // ==================================================
    // EMAIL
    // ==================================================

    if (req.body.email !== undefined) {
      const normalizedEmail = String(req.body.email).trim().toLowerCase();

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid email address.",
        });
      }

      const duplicate = await Seeker.findOne({
        email: normalizedEmail,

        seeker_id: {
          $ne: seekerId,
        },
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: "Another job seeker already uses this email.",
        });
      }

      seeker.email = normalizedEmail;
    }

    // ==================================================
    // NORMAL EDITABLE FIELDS
    // ==================================================

    const allowedFields = [
      "name",
      "phone",
      "address",
      "current_location",
      "date_of_birth",
      "gender",
      "nationality",
      "visa_type",
      "visa_expiry_date",
      "japanese_level",
      "desired_job",
      "desired_location",
      "available_from",
      "notes",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        seeker[field] = req.body[field] === "" ? null : req.body[field];
      }
    });

    // ==================================================
    // SKILLS
    // ==================================================

    if (req.body.skills !== undefined) {
      if (!Array.isArray(req.body.skills)) {
        return res.status(400).json({
          success: false,
          message: "Skills must be an array.",
        });
      }

      seeker.skills = req.body.skills;
    }

    await seeker.save();

    const applicationsCount = await Application.countDocuments({
      seeker_id: seekerId,
    });

    return res.status(200).json({
      success: true,

      message: "Job seeker updated successfully.",

      data: serializeSeeker(seeker, applicationsCount),
    });
  } catch (error) {
    console.error("UPDATE ADMIN SEEKER ERROR:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update job seeker.",
    });
  }
};

// ======================================================
// APPROVE / REJECT SEEKER
//
// PATCH
// /api/admin/seekers/:seekerId/approval
//
// Body:
//
// {
//   "decision": "approved"
// }
//
// OR
//
// {
//   "decision": "rejected",
//   "reason": "..."
// }
// ======================================================

exports.updateApprovalStatus = async (req, res) => {
  try {
    const { seekerId } = req.params;

    const { decision, reason = null } = req.body;

    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: "Decision must be approved or rejected.",
      });
    }

    if (decision === "rejected" && (!reason || !String(reason).trim())) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required.",
      });
    }

    const seeker = await Seeker.findOne({
      seeker_id: seekerId,
    });

    if (!seeker) {
      return res.status(404).json({
        success: false,
        message: "Job seeker not found.",
      });
    }

    seeker.approval_status = decision;

    seeker.approval_reviewed_at = new Date();

    if (decision === "approved") {
      seeker.rejection_reason = null;

      if (seeker.account_status !== "suspended") {
        seeker.account_status = "active";
      }
    }

    if (decision === "rejected") {
      seeker.rejection_reason = String(reason).trim();

      seeker.account_status = "inactive";
    }

    await seeker.save();

    return res.status(200).json({
      success: true,

      message:
        decision === "approved"
          ? "Job seeker approved successfully."
          : "Job seeker rejected successfully.",

      data: serializeSeeker(seeker),
    });
  } catch (error) {
    console.error("UPDATE SEEKER APPROVAL ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update approval status.",
    });
  }
};

// ======================================================
// UPDATE ACCOUNT STATUS
//
// PATCH
// /api/admin/seekers/:seekerId/account-status
//
// {
//   "status": "active"
// }
// ======================================================

exports.updateAccountStatus = async (req, res) => {
  try {
    const { seekerId } = req.params;
    const { status } = req.body;

    if (!ACCOUNT_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid account status.",
      });
    }

    const seeker = await Seeker.findOne({
      seeker_id: seekerId,
    });

    if (!seeker) {
      return res.status(404).json({
        success: false,
        message: "Job seeker not found.",
      });
    }

    if (status === "active" && seeker.approval_status !== "approved") {
      return res.status(400).json({
        success: false,
        message: "Only approved job seekers can be activated.",
      });
    }

    seeker.account_status = status;

    await seeker.save();

    return res.status(200).json({
      success: true,

      message: "Account status updated successfully.",

      data: serializeSeeker(seeker),
    });
  } catch (error) {
    console.error("UPDATE SEEKER ACCOUNT STATUS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update account status.",
    });
  }
};

// ======================================================
// UPDATE PLACEMENT STATUS
//
// PATCH
// /api/admin/seekers/:seekerId/placement-status
// ======================================================

exports.updatePlacementStatus = async (req, res) => {
  try {
    const { seekerId } = req.params;
    const { status } = req.body;

    if (!PLACEMENT_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid placement status.",
      });
    }

    const seeker = await Seeker.findOne({
      seeker_id: seekerId,
    });

    if (!seeker) {
      return res.status(404).json({
        success: false,
        message: "Job seeker not found.",
      });
    }

    seeker.placement_status = status;

    await seeker.save();

    return res.status(200).json({
      success: true,

      message: "Placement status updated successfully.",

      data: serializeSeeker(seeker),
    });
  } catch (error) {
    console.error("UPDATE SEEKER PLACEMENT STATUS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update placement status.",
    });
  }
};

// ======================================================
// ADMIN DOWNLOAD SEEKER RESUME
//
// GET
// /api/admin/seekers/:seekerId/resume
// ======================================================

exports.getSeekerResume = async (req, res) => {
  try {
    const { seekerId } = req.params;

    const seeker = await Seeker.findOne({
      seeker_id: seekerId,
    }).select("seeker_id name resume_file generated_resume_file");

    if (!seeker) {
      return res.status(404).json({
        success: false,
        message: "Job seeker not found.",
      });
    }

    const resumeUrl = seeker.resume_file || seeker.generated_resume_file;

    if (!resumeUrl) {
      return res.status(404).json({
        success: false,
        message: "This job seeker has no resume.",
      });
    }

    const fileName = path.basename(resumeUrl);

    const filePath = path.join(__dirname, "../../uploads", fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "Resume file not found.",
      });
    }

    return res.download(filePath, `${seeker.seeker_id}-${fileName}`);
  } catch (error) {
    console.error("ADMIN DOWNLOAD SEEKER RESUME ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to download resume.",
    });
  }
};

// ======================================================
// DELETE SEEKER
//
// DELETE /api/admin/seekers/:seekerId
//
// Safety:
//
// Cannot hard delete seeker with applications.
// Cannot hard delete placed seeker.
//
// Instead use inactive/suspended.
// ======================================================

exports.deleteSeeker = async (req, res) => {
  try {
    const { seekerId } = req.params;

    const seeker = await Seeker.findOne({
      seeker_id: seekerId,
    });

    if (!seeker) {
      return res.status(404).json({
        success: false,
        message: "Job seeker not found.",
      });
    }

    const applicationsCount = await Application.countDocuments({
      seeker_id: seekerId,
    });

    if (applicationsCount > 0) {
      return res.status(409).json({
        success: false,

        message:
          "This job seeker has application history and cannot be permanently deleted. Suspend or deactivate the account instead.",
      });
    }

    if (seeker.placement_status === "placed") {
      return res.status(409).json({
        success: false,

        message: "A placed job seeker cannot be permanently deleted.",
      });
    }

    // ==================================================
    // SAVE FILE REFERENCES BEFORE DELETE
    // ==================================================

    const filesToDelete = [
      seeker.profile_photo,
      seeker.resume_file,
      seeker.generated_resume_file,
      ...(seeker.other_documents || []).map((document) => document.file_url),
    ].filter(Boolean);

    await seeker.deleteOne();

    filesToDelete.forEach(deleteStoredFile);

    return res.status(200).json({
      success: true,
      message: "Job seeker deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE ADMIN SEEKER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete job seeker.",
    });
  }
};
