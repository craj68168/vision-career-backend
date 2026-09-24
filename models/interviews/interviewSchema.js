const mongoose = require("mongoose");

// ======================================================
// INTERVIEW METHODS
// ======================================================

const INTERVIEW_METHODS = [
  "ZOOM",
  "GOOGLE_MEET",
  "PHONE",
  "FACE_TO_FACE",
  "OTHER",
];

// ======================================================
// INTERVIEW STATUSES
// ======================================================

const INTERVIEW_STATUSES = [
  "AWAITING_LINK",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
];

// ======================================================
// ACTOR ROLES
// ======================================================

const INTERVIEW_ACTOR_ROLES = ["provider", "admin", "staff"];

// ======================================================
// INTERVIEW SCHEMA
// ======================================================

const interviewSchema = new mongoose.Schema(
  {
    // ==================================================
    // CUSTOM INTERVIEW ID
    //
    // Example:
    // INT-A12B34CD
    // ==================================================

    interview_id: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      index: true,
      trim: true,
    },

    // ==================================================
    // APPLICATION
    // ==================================================

    application_id: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      index: true,
      trim: true,
    },

    // ==================================================
    // RELATIONSHIPS
    // ==================================================

    seeker_id: {
      type: String,
      required: true,
      immutable: true,
      index: true,
      trim: true,
    },

    provider_id: {
      type: String,
      required: true,
      immutable: true,
      index: true,
      trim: true,
    },

    vacancy_id: {
      type: String,
      required: true,
      immutable: true,
      index: true,
      trim: true,
    },

    // ==================================================
    // INTERVIEW DATE
    // ==================================================

    interview_date: {
      type: Date,
      required: true,
      index: true,
    },

    // ==================================================
    // INTERVIEW TIME
    //
    // HH:mm
    // ==================================================

    interview_time: {
      type: String,
      required: true,
      trim: true,

      validate: {
        validator(value) {
          return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
        },

        message: "Interview time must use HH:mm format.",
      },
    },

    // ==================================================
    // TIMEZONE
    // ==================================================

    timezone: {
      type: String,
      required: true,
      default: "Asia/Tokyo",
      trim: true,
      maxlength: 100,
    },

    // ==================================================
    // INTERVIEW METHOD
    // ==================================================

    interview_method: {
      type: String,
      required: true,
      enum: INTERVIEW_METHODS,
      index: true,
    },

    // ==================================================
    // MEETING LINK
    // ==================================================

    meeting_link: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2000,
    },

    // ==================================================
    // NOTES
    // ==================================================

    notes: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2000,
    },

    // ==================================================
    // INTERVIEW STATUS
    // ==================================================

    status: {
      type: String,
      required: true,
      enum: INTERVIEW_STATUSES,
      default: "CONFIRMED",
      index: true,
    },

    // ==================================================
    // SCHEDULED BY
    // ==================================================

    scheduled_by_role: {
      type: String,
      required: true,
      enum: INTERVIEW_ACTOR_ROLES,
    },

    scheduled_by_id: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // ==================================================
    // LAST UPDATED BY
    // ==================================================

    updated_by_role: {
      type: String,
      required: true,
      enum: INTERVIEW_ACTOR_ROLES,
    },

    updated_by_id: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // ==================================================
    // CONFIRMATION
    // ==================================================

    confirmed_at: {
      type: Date,
      default: null,
    },

    // ==================================================
    // NOTIFICATION
    // ==================================================

    notification_sent_at: {
      type: Date,
      default: null,
    },

    // ==================================================
    // COMPLETED
    // ==================================================

    completed_at: {
      type: Date,
      default: null,
    },

    completed_by_role: {
      type: String,
      enum: INTERVIEW_ACTOR_ROLES,
      default: null,
    },

    completed_by_id: {
      type: String,
      default: null,
      trim: true,
    },

    // ==================================================
    // CANCELLED
    // ==================================================

    cancelled_at: {
      type: Date,
      default: null,
    },

    cancelled_by_role: {
      type: String,
      enum: INTERVIEW_ACTOR_ROLES,
      default: null,
    },

    cancelled_by_id: {
      type: String,
      default: null,
      trim: true,
    },

    cancellation_reason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1000,
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

interviewSchema.index({
  provider_id: 1,
  interview_date: 1,
  interview_time: 1,
});

interviewSchema.index({
  seeker_id: 1,
  interview_date: 1,
});

interviewSchema.index({
  status: 1,
  interview_date: 1,
});

// ======================================================
// MODEL
// ======================================================

const Interview =
  mongoose.models.Interview || mongoose.model("Interview", interviewSchema);

// ======================================================
// EXPORT
//
// IMPORTANT:
//
// The controller expects:
//
// const Interview = require(...)
//
// Therefore export the model DIRECTLY.
// ======================================================

module.exports = Interview;
