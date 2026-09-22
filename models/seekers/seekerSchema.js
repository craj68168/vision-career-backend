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

    password: {
      type: String,
      required: true,
      select: false,
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
    // ADMIN APPROVAL
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

    rejection_reason: {
      type: String,
      default: null,
      trim: true,
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
// MODEL
// ======================================================

module.exports = mongoose.model("Seeker", seekerSchema);
