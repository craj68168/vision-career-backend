const mongoose = require("mongoose");

const recruitSchema = new mongoose.Schema(
  {
    recruitId: {
      type: String,
      unique: true,
      index: true,
      required: true,
    },

    // Provider registerId
    company_id: {
      type: String,
      required: true,
      index: true,
    },

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
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Recruit", recruitSchema);
