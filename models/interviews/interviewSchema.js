const mongoose = require("mongoose");

// ======================================================
// INTERVIEW SOURCES
// ======================================================

const INTERVIEW_SOURCES = ["APPLICATION", "PLACEMENT"];

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
    // SOURCE
    //
    // APPLICATION:
    // application_id + vacancy_id
    //
    // PLACEMENT:
    // placement_candidate_id + recruit_id
    // ==================================================

    source_type: {
      type: String,
      required: true,
      enum: INTERVIEW_SOURCES,
      default: "APPLICATION",
      immutable: true,
      index: true,
    },

    // ==================================================
    // APPLICATION SOURCE
    // ==================================================

    application_id: {
      type: String,
      default: null,
      immutable: true,
      trim: true,
    },

    vacancy_id: {
      type: String,
      default: null,
      immutable: true,
      trim: true,
    },

    // ==================================================
    // PLACEMENT SOURCE
    // ==================================================

    placement_candidate_id: {
      type: String,
      default: null,
      immutable: true,
      trim: true,
    },

    recruit_id: {
      type: String,
      default: null,
      immutable: true,
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

    // ==================================================
    // DATE
    // ==================================================

    interview_date: {
      type: Date,
      required: true,
      index: true,
    },

    // ==================================================
    // TIME
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
    // METHOD
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
    // STATUS
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
    // UPDATED BY
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
    // CONFIRMED
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
// SOURCE VALIDATION
// ======================================================

interviewSchema.pre("validate", function () {
  if (this.source_type === "APPLICATION") {
    if (!this.application_id) {
      this.invalidate(
        "application_id",
        "application_id is required for application interviews.",
      );
    }

    if (!this.vacancy_id) {
      this.invalidate(
        "vacancy_id",
        "vacancy_id is required for application interviews.",
      );
    }
  }

  if (this.source_type === "PLACEMENT") {
    if (!this.placement_candidate_id) {
      this.invalidate(
        "placement_candidate_id",
        "placement_candidate_id is required for placement interviews.",
      );
    }

    if (!this.recruit_id) {
      this.invalidate(
        "recruit_id",
        "recruit_id is required for placement interviews.",
      );
    }
  }
});

// ======================================================
// UNIQUE SOURCE INDEXES
// ======================================================

interviewSchema.index(
  {
    application_id: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      source_type: "APPLICATION",
      application_id: {
        $type: "string",
      },
    },
    name: "unique_application_interview",
  },
);

interviewSchema.index(
  {
    placement_candidate_id: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      source_type: "PLACEMENT",
      placement_candidate_id: {
        $type: "string",
      },
    },
    name: "unique_placement_candidate_interview",
  },
);

// ======================================================
// QUERY INDEXES
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

interviewSchema.index({
  source_type: 1,
  provider_id: 1,
});

// ======================================================
// MODEL
// ======================================================

const Interview =
  mongoose.models.Interview || mongoose.model("Interview", interviewSchema);

module.exports = Interview;
