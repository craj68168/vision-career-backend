const mongoose = require("mongoose");

const recruitSchema = new mongoose.Schema(
  {
    recruitId: {
      type: String,
      unique: true,
      index: true,
    },

    // 🔥 AUTO FROM LOGIN
    company_id: {
      type: String,
      required: true,
      index: true,
    },

    job_title: { type: String, default: "" },
    job_category: { type: String, default: "" },
    employment_type: { type: String, default: "" },

    number_of_positions: { type: Number, default: 1 },

    work_location: { type: String, default: "" },
    job_description: { type: String, default: "" },
    requirements: { type: String, default: "" },

    japanese_level_required: { type: String, default: "" },
    visa_type_required: { type: String, default: "" },

    salary_type: { type: String, default: "" },
    salary_amount: { type: Number, default: 0 },

    working_hours: { type: String, default: "" },
    days_off: { type: String, default: "" },

    start_date: { type: String, default: "" },

    status: {
      type: String,
      enum: ["draft", "pending_review", "approved", "rejected"],
      default: "draft",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Recruit", recruitSchema);