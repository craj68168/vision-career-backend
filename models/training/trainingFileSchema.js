const mongoose = require("mongoose");

// ======================================================
// TRAINING FILE
// ======================================================

const trainingFileSchema = new mongoose.Schema(
  {
    fileId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
    },

    topicId: {
      type: String,
      required: true,
      index: true,
    },

    fileTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },

    originalFileName: {
      type: String,
      required: true,
      trim: true,
    },

    storedFileName: {
      type: String,
      required: true,
      trim: true,
    },

    filePath: {
      type: String,
      required: true,
      trim: true,
    },

    fileType: {
      type: String,

      enum: ["pdf", "video", "image", "doc", "excel", "ppt", "other"],

      default: "other",
    },

    mimeType: {
      type: String,
      default: null,
      trim: true,
    },

    fileSize: {
      type: Number,
      default: null,
      min: 0,
    },

    externalUrl: {
      type: String,
      default: null,
      trim: true,
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

    uploadedByAdminId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("TrainingFile", trainingFileSchema);
