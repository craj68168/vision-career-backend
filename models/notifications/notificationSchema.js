const mongoose = require("mongoose");

// ======================================================
// NOTIFICATION TYPES
// ======================================================

const NOTIFICATION_TYPES = [
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_CONFIRMED",
  "INTERVIEW_UPDATED",
  "INTERVIEW_CANCELLED",
];

// ======================================================
// RECIPIENT TYPES
// ======================================================

const RECIPIENT_TYPES = ["seeker"];

// ======================================================
// INTERVIEW NOTIFICATION DATA
// ======================================================
//
// This stores only information that may safely be shown
// to the candidate.
//
// ======================================================

const interviewDataSchema = new mongoose.Schema(
  {
    interview_id: {
      type: String,
      default: null,
      trim: true,
    },

    application_id: {
      type: String,
      default: null,
      trim: true,
    },

    vacancy_id: {
      type: String,
      default: null,
      trim: true,
    },

    company_name: {
      type: String,
      default: null,
      trim: true,
    },

    job_title: {
      type: String,
      default: null,
      trim: true,
    },

    interview_date: {
      type: Date,
      default: null,
    },

    interview_time: {
      type: String,
      default: null,
      trim: true,
    },

    timezone: {
      type: String,
      default: null,
      trim: true,
    },

    interview_method: {
      type: String,
      default: null,
      trim: true,
    },

    meeting_link: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2000,
    },

    notes: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2000,
    },
  },
  {
    _id: false,
  },
);

// ======================================================
// NOTIFICATION SCHEMA
// ======================================================

const notificationSchema = new mongoose.Schema(
  {
    // ==================================================
    // CUSTOM NOTIFICATION ID
    //
    // Example:
    //
    // NTF-A12B34CD
    // ==================================================

    notification_id: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      index: true,
      trim: true,
    },

    // ==================================================
    // RECIPIENT
    // ==================================================

    recipient_type: {
      type: String,
      required: true,
      enum: RECIPIENT_TYPES,
      index: true,
    },

    recipient_id: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    // ==================================================
    // TYPE
    // ==================================================

    type: {
      type: String,
      required: true,
      enum: NOTIFICATION_TYPES,
      index: true,
    },

    // ==================================================
    // CONTENT
    // ==================================================

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },

    // ==================================================
    // RELATED INTERVIEW INFORMATION
    // ==================================================

    interview: {
      type: interviewDataSchema,
      default: null,
    },

    // ==================================================
    // READ STATUS
    // ==================================================

    is_read: {
      type: Boolean,
      default: false,
      index: true,
    },

    read_at: {
      type: Date,
      default: null,
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
// INDEXES
// ======================================================

// Seeker notification feed.

notificationSchema.index({
  recipient_type: 1,
  recipient_id: 1,
  created_at: -1,
});

// Unread notification count.

notificationSchema.index({
  recipient_type: 1,
  recipient_id: 1,
  is_read: 1,
});

// ======================================================
// MODEL
// ======================================================

module.exports = mongoose.model("Notification", notificationSchema);
