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
// INTERVIEW DATA
// ======================================================

const interviewDataSchema = new mongoose.Schema(
  {
    interview_id: {
      type: String,
      default: null,
      trim: true,
    },

    source_type: {
      type: String,
      enum: ["APPLICATION", "PLACEMENT"],
      default: null,
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

    placement_candidate_id: {
      type: String,
      default: null,
      trim: true,
    },

    recruit_id: {
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
// NOTIFICATION
// ======================================================

const notificationSchema = new mongoose.Schema(
  {
    notification_id: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      index: true,
      trim: true,
    },

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

    type: {
      type: String,
      required: true,
      enum: NOTIFICATION_TYPES,
      index: true,
    },

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

    interview: {
      type: interviewDataSchema,
      default: null,
    },

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

notificationSchema.index({
  recipient_type: 1,
  recipient_id: 1,
  created_at: -1,
});

notificationSchema.index({
  recipient_type: 1,
  recipient_id: 1,
  is_read: 1,
});

// ======================================================
// MODEL
// ======================================================

const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);

module.exports = Notification;
