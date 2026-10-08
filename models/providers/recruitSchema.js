const mongoose = require("mongoose");

// ======================================================
// WORKFLOW HISTORY
//
// IMPORTANT:
//
// This contains internal Admin / Staff audit information.
//
// select: false is used on the parent field so Provider
// APIs do not accidentally expose internal actor IDs,
// actor names or workflow history.
//
// Admin / Staff controllers must explicitly use:
//
// .select("+workflow_history")
//
// ======================================================

const workflowHistorySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: [
        "SCREENED",
        "NEEDS_ATTENTION",
        "APPROVED",
        "REJECTED",
        "RESUBMITTED",
      ],
      required: true,
    },

    from_status: {
      type: String,
      default: null,
    },

    to_status: {
      type: String,
      default: null,
    },

    actor_role: {
      type: String,
      enum: ["admin", "staff", "provider", "system"],
      default: null,
    },

    actor_id: {
      type: String,
      default: null,
      trim: true,
    },

    actor_name_snapshot: {
      type: String,
      default: null,
      trim: true,
    },

    note: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2000,
    },

    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  },
);

// ======================================================
// RECRUIT / PLACEMENT REQUEST SCHEMA
// ======================================================

const recruitSchema = new mongoose.Schema(
  {
    // ==================================================
    // IDENTIFIER
    // ==================================================

    recruitId: {
      type: String,
      unique: true,
      index: true,
      required: true,
    },

    // ==================================================
    // PROVIDER
    // ==================================================

    company_id: {
      type: String,
      required: true,
      index: true,
    },

    // ==================================================
    // JOB INFORMATION
    // ==================================================

    job_title: {
      type: String,
      default: "",
      trim: true,
    },

    job_category: {
      type: String,
      default: "",
      trim: true,
    },

    employment_type: {
      type: String,
      default: "",
      trim: true,
    },

    number_of_positions: {
      type: Number,
      default: 1,
      min: 1,
    },

    work_location: {
      type: String,
      default: "",
      trim: true,
    },

    job_description: {
      type: String,
      default: "",
      trim: true,
    },

    requirements: {
      type: String,
      default: "",
      trim: true,
    },

    japanese_level_required: {
      type: String,
      default: "",
      trim: true,
    },

    visa_type_required: {
      type: String,
      default: "",
      trim: true,
    },

    // ==================================================
    // SALARY / CONDITIONS
    // ==================================================

    salary_type: {
      type: String,
      default: "",
      trim: true,
    },

    salary_amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    working_hours: {
      type: String,
      default: "",
      trim: true,
    },

    days_off: {
      type: String,
      default: "",
      trim: true,
    },

    start_date: {
      type: String,
      default: "",
      trim: true,
    },

    // ==================================================
    // WORKFLOW STATUS
    // ==================================================

    status: {
      type: String,
      enum: ["draft", "pending_review", "approved", "rejected"],
      default: "draft",
      index: true,
    },

    submitted_at: {
      type: Date,
      default: null,
    },

    // ==================================================
    // FINAL REVIEW / DECISION AUDIT
    // ==================================================

    reviewed_at: {
      type: Date,
      default: null,
    },

    reviewed_by_role: {
      type: String,
      enum: ["admin", "staff"],
      default: null,
      index: true,
    },

    reviewed_by_id: {
      type: String,
      default: null,
      index: true,
    },

    rejection_reason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1000,
    },

    // ==================================================
    // STAFF SCREENING
    //
    // Screening is independent from final approval.
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
    // COMPLETE INTERNAL WORKFLOW HISTORY
    //
    // DO NOT expose this to Provider APIs.
    // ==================================================

    workflow_history: {
      type: [workflowHistorySchema],
      default: [],
      select: false,
    },
  },
  {
    timestamps: true,
  },
);

// ======================================================
// INDEXES
// ======================================================

recruitSchema.index({
  company_id: 1,
  createdAt: -1,
});

recruitSchema.index({
  status: 1,
  createdAt: -1,
});

recruitSchema.index({
  staff_screening_status: 1,
  createdAt: -1,
});

module.exports = mongoose.model("Recruit", recruitSchema);
