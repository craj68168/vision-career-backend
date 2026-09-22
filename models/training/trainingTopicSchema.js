const mongoose = require("mongoose");

// ======================================================
// TRAINING TOPIC
// ======================================================

const trainingTopicSchema = new mongoose.Schema(
  {
    topicId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
    },

    categoryId: {
      type: String,
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },

    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    description: {
      type: String,
      default: null,
      trim: true,
      maxlength: 5000,
    },

    sortOrder: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },

    createdByAdminId: {
      type: String,
      default: null,
    },

    updatedByAdminId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Same slug may exist in another category,
// but not twice inside the same category.

trainingTopicSchema.index(
  {
    categoryId: 1,
    slug: 1,
  },
  {
    unique: true,
  },
);

module.exports = mongoose.model("TrainingTopic", trainingTopicSchema);
