const mongoose = require("mongoose");

// ======================================================

// EDUCATION SCHEMA

// ======================================================

const educationSchema = new mongoose.Schema(
  {
    enrollment_date: {
      type: Date,

      default: null,
    },

    graduation_date: {
      type: Date,

      default: null,
    },

    school_type: {
      type: String,

      default: null,

      trim: true,
    },

    school: {
      type: String,

      required: true,

      trim: true,
    },

    major: {
      type: String,

      default: null,

      trim: true,
    },
  },

  {
    _id: true,

    timestamps: {
      createdAt: "created_at",

      updatedAt: "updated_at",
    },
  },
);

// ======================================================

// EMPLOYMENT HISTORY SCHEMA

// ======================================================

const employmentSchema = new mongoose.Schema(
  {
    start_date: {
      type: Date,

      default: null,
    },

    end_date: {
      type: Date,

      default: null,
    },

    employment_type: {
      type: String,

      default: null,

      trim: true,
    },

    company_name: {
      type: String,

      required: true,

      trim: true,
    },
  },

  {
    _id: true,

    timestamps: {
      createdAt: "created_at",

      updatedAt: "updated_at",
    },
  },
);

// ======================================================

// OTHER DOCUMENTS SCHEMA

// ======================================================

const documentSchema = new mongoose.Schema(
  {
    name: {
      type: String,

      required: true,

      trim: true,
    },

    file_url: {
      type: String,

      required: true,

      trim: true,
    },

    document_type: {
      type: String,

      default: "other",

      trim: true,
    },
  },

  {
    _id: true,

    timestamps: {
      createdAt: "created_at",

      updatedAt: "updated_at",
    },
  },
);

// ======================================================

// APPROVAL HISTORY SCHEMA

// ======================================================

const approvalHistorySchema = new mongoose.Schema(
  {
    decision: {
      type: String,

      enum: ["approved", "rejected"],

      required: true,
    },

    actor_type: {
      type: String,

      enum: ["admin", "staff"],

      required: true,
    },

    actor_id: {
      type: String,

      required: true,

      trim: true,
    },

    actor_name: {
      type: String,

      default: null,

      trim: true,
    },

    reason: {
      type: String,

      default: null,

      trim: true,

      maxlength: 2000,
    },

    reviewed_at: {
      type: Date,

      required: true,

      default: Date.now,
    },
  },

  {
    _id: true,
  },
);

// ======================================================

// MAIN SEEKER SCHEMA

// ======================================================

const seekerSchema = new mongoose.Schema(
  {
    // ==================================================

    // ACCOUNT INFORMATION

    // ==================================================

    seeker_id: {
      type: String,

      required: true,

      unique: true,

      immutable: true,
    },

    name: {
      type: String,

      required: true,

      trim: true,
    },

    email: {
      type: String,

      required: true,

      unique: true,

      lowercase: true,

      trim: true,
    },

    account_source: {
      type: String,

      enum: ["self_registration", "admin"],

      default: "self_registration",

      index: true,
    },

    password: {
      type: String,

      required: true,

      select: false,
    },

    password_setup_required: {
      type: Boolean,

      default: false,
    },

    // ==================================================

    // PASSWORD RESET

    // ==================================================

    password_reset_code_hash: {
      type: String,

      default: null,

      select: false,
    },

    password_reset_code_expires: {
      type: Date,

      default: null,

      select: false,
    },

    password_reset_attempts: {
      type: Number,

      default: 0,

      select: false,
    },

    password_reset_token_hash: {
      type: String,

      default: null,

      select: false,
    },

    password_reset_token_expires: {
      type: Date,

      default: null,

      select: false,
    },

    // ==================================================

    // ADMIN / STAFF APPROVAL

    // ==================================================

    approval_status: {
      type: String,

      enum: ["pending", "approved", "rejected"],

      default: "pending",
    },

    account_status: {
      type: String,

      enum: ["inactive", "active", "suspended"],

      default: "inactive",
    },

    approval_reviewed_at: {
      type: Date,

      default: null,
    },

    approval_reviewed_by_type: {
      type: String,

      enum: ["admin", "staff"],

      default: null,
    },

    approval_reviewed_by_id: {
      type: String,

      default: null,

      trim: true,

      index: true,
    },

    approval_reviewed_by_name: {
      type: String,

      default: null,

      trim: true,
    },

    rejection_reason: {
      type: String,

      default: null,

      trim: true,

      maxlength: 2000,
    },

    approval_history: {
      type: [approvalHistorySchema],

      default: [],
    },

    // ==================================================

    // STAFF SCREENING

    // ==================================================

    staff_screening_status: {
      type: String,

      enum: ["NOT_SCREENED", "SCREENED", "NEEDS_ATTENTION"],

      default: "NOT_SCREENED",

      index: true,
    },

    staff_screening_note: {
      type: String,

      default: null,

      trim: true,

      maxlength: 2000,
    },

    screened_by_staff_id: {
      type: String,

      default: null,

      index: true,
    },

    screened_at: {
      type: Date,

      default: null,
    },

    // ==================================================

    // BASIC PROFILE

    // ==================================================

    profile_photo: {
      type: String,

      default: null,
    },

    phone: {
      type: String,

      default: null,

      trim: true,
    },

    address: {
      type: String,

      default: null,

      trim: true,
    },

    current_location: {
      type: String,

      default: null,

      trim: true,
    },

    date_of_birth: {
      type: Date,

      default: null,
    },

    gender: {
      type: String,

      default: null,

      trim: true,
    },

    nationality: {
      type: String,

      default: null,

      trim: true,
    },

    // ==================================================

    // VISA INFORMATION

    // ==================================================

    visa_type: {
      type: String,

      default: null,

      trim: true,
    },

    visa_expiry_date: {
      type: Date,

      default: null,
    },

    // ==================================================

    // LANGUAGE / SKILLS

    // ==================================================

    japanese_level: {
      type: String,

      default: null,

      trim: true,
    },

    skills: {
      type: [String],

      default: [],
    },

    // ==================================================

    // JOB PREFERENCES

    // ==================================================

    desired_job: {
      type: String,

      default: null,

      trim: true,
    },

    desired_location: {
      type: String,

      default: null,

      trim: true,
    },

    available_from: {
      type: Date,

      default: null,
    },

    // ==================================================

    // RESUME / DOCUMENTS

    // ==================================================

    resume_file: {
      type: String,

      default: null,
    },

    generated_resume_file: {
      type: String,

      default: null,
    },

    other_documents: {
      type: [documentSchema],

      default: [],
    },

    // ==================================================

    // EDUCATION

    // ==================================================

    education: {
      type: [educationSchema],

      default: [],
    },

    // ==================================================

    // EMPLOYMENT HISTORY

    // ==================================================

    employment_history: {
      type: [employmentSchema],

      default: [],
    },

    // ==================================================

    // RECRUITMENT / PLACEMENT

    // ==================================================

    placement_status: {
      type: String,

      enum: ["unplaced", "matching", "interview", "selected", "placed"],

      default: "unplaced",
    },

    // ==================================================

    // OTHER INFORMATION

    // ==================================================

    notes: {
      type: String,

      default: null,

      trim: true,

      maxlength: 500,
    },
  },

  {
    timestamps: {
      createdAt: "created_at",

      updatedAt: "updated_at",
    },
  },
);

// ======================================================

// RECORD APPROVAL DECISION

//

// Shared by Admin and authorized Staff so both flows use

// exactly the same approval/account state rules and audit

// history structure.

// ======================================================

seekerSchema.methods.recordApprovalDecision = function ({
  decision,

  actorType,

  actorId,

  actorName = null,

  reason = null,
}) {
  if (!["approved", "rejected"].includes(decision)) {
    throw new Error("Invalid approval decision.");
  }

  if (!["admin", "staff"].includes(actorType)) {
    throw new Error("Invalid approval actor type.");
  }

  if (!actorId) {
    throw new Error("Approval actor ID is required.");
  }

  const normalizedReason = typeof reason === "string" ? reason.trim() : "";

  if (decision === "rejected" && !normalizedReason) {
    throw new Error("Rejection reason is required.");
  }

  if (normalizedReason.length > 2000) {
    throw new Error("Rejection reason cannot exceed 2000 characters.");
  }

  const reviewedAt = new Date();

  this.approval_status = decision;

  this.approval_reviewed_at = reviewedAt;

  this.approval_reviewed_by_type = actorType;

  this.approval_reviewed_by_id = String(actorId).trim();

  this.approval_reviewed_by_name = actorName
    ? String(actorName).trim() || null
    : null;

  if (decision === "approved") {
    this.rejection_reason = null;

    if (this.account_status !== "suspended") {
      this.account_status = "active";
    }
  }

  if (decision === "rejected") {
    this.rejection_reason = normalizedReason;

    this.account_status = "inactive";
  }

  this.approval_history.push({
    decision,

    actor_type: actorType,

    actor_id: String(actorId).trim(),

    actor_name: this.approval_reviewed_by_name,

    reason: decision === "rejected" ? normalizedReason : null,

    reviewed_at: reviewedAt,
  });

  return this;
};

// ======================================================

// MODEL

// ======================================================

module.exports = mongoose.model("Seeker", seekerSchema);
