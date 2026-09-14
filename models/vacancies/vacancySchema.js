const mongoose = require("mongoose");

const vacancySchema = new mongoose.Schema(
  {
    vacancy_id: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      index: true,
    },

    provider_id: {
      type: String,
      required: true,
      index: true,
    },

    job_title: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: [
        "draft",
        "pending_admin_approval",
        "published",
        "rejected",
        "closed",
      ],
      default: "draft",
      index: true,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
);

module.exports = mongoose.model(
  "Vacancy",
  vacancySchema,
);