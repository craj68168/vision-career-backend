const mongoose = require("mongoose");

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

    // Provider registerId
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

    reviewed_at: {
      type: Date,
      default: null,
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
    // Staff screening does NOT modify status.
    //
    // Admin remains responsible for final
    // approval / rejection.
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
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Recruit", recruitSchema);
