const mongoose = require("mongoose");

// ======================================================
// PROFESSIONAL PROFILE SNAPSHOT
// ======================================================
//
// This stores the professional information that existed
// when the seeker submitted the application.
//
// IMPORTANT:
// Do NOT store:
// - email
// - phone
// - full address
// - profile photo
// - private documents
//
// Those remain protected.
// ======================================================

const educationSnapshotSchema = new mongoose.Schema(
  {
    enrollment_date: {
      type: Date,
      default: null,
    },

    graduation_date: {
      type: Date,
      default: null,
    },

    school_type: {
      type: String,
      default: null,
      trim: true,
    },

    school: {
      type: String,
      default: null,
      trim: true,
    },

    major: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    _id: false,
  },
);

const employmentSnapshotSchema = new mongoose.Schema(
  {
    start_date: {
      type: Date,
      default: null,
    },

    end_date: {
      type: Date,
      default: null,
    },

    employment_type: {
      type: String,
      default: null,
      trim: true,
    },

    company_name: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    _id: false,
  },
);

const profileSnapshotSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: null,
      trim: true,
    },

    nationality: {
      type: String,
      default: null,
      trim: true,
    },

    visa_type: {
      type: String,
      default: null,
      trim: true,
    },

    visa_expiry_date: {
      type: Date,
      default: null,
    },

    japanese_level: {
      type: String,
      default: null,
      trim: true,
    },

    skills: {
      type: [String],
      default: [],
    },

    desired_job: {
      type: String,
      default: null,
      trim: true,
    },

    desired_location: {
      type: String,
      default: null,
      trim: true,
    },

    education: {
      type: [educationSnapshotSchema],
      default: [],
    },

    employment_history: {
      type: [employmentSnapshotSchema],
      default: [],
    },

    generated_resume_file: {
      type: String,
      default: null,
    },
  },
  {
    _id: false,
  },
);

// ======================================================
// APPLICATION SCHEMA
// ======================================================

const applicationSchema = new mongoose.Schema(
  {
    // --------------------------------------------------
    // CUSTOM APPLICATION ID
    // Example: APP-A12B34CD
    // --------------------------------------------------

    application_id: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      index: true,
    },

    // --------------------------------------------------
    // RELATIONSHIPS
    // --------------------------------------------------

    seeker_id: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    vacancy_id: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    provider_id: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    // --------------------------------------------------
    // APPLICATION CONTENT
    // --------------------------------------------------

    cover_letter: {
      type: String,
      default: null,
      trim: true,
      maxlength: 3000,
    },

    // Professional information captured at application time.
    profile_snapshot: {
      type: profileSnapshotSchema,
      default: () => ({}),
    },

    // --------------------------------------------------
    // APPLICATION STATUS
    // --------------------------------------------------

    status: {
      type: String,

      enum: [
        "PENDING_ADMIN_APPROVAL",

        "ADMIN_REJECTED",

        "SENT_TO_PROVIDER",

        "UNDER_REVIEW",

        "INTERVIEW",

        "SELECTED",

        "HIRED",

        "REJECTED",
      ],

      default: "PENDING_ADMIN_APPROVAL",

      index: true,
    },

    // --------------------------------------------------
    // ADMIN REVIEW
    // --------------------------------------------------

    admin_reviewed_at: {
      type: Date,
      default: null,
    },

    admin_reviewed_by: {
      type: String,
      default: null,
      trim: true,
    },

    admin_rejection_reason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1000,
    },

    // --------------------------------------------------
    // APPLICATION DATE
    // --------------------------------------------------

    applied_at: {
      type: Date,
      default: Date.now,
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
// PREVENT DUPLICATE APPLICATIONS
// ======================================================
//
// One seeker can apply to one vacancy only once.
//
// This is important even if the controller already checks,
// because two requests could theoretically arrive at the
// same time.
// ======================================================

applicationSchema.index(
  {
    seeker_id: 1,
    vacancy_id: 1,
  },
  {
    unique: true,
  },
);

// ======================================================
// USEFUL QUERY INDEXES
// ======================================================

// Admin pending application list
applicationSchema.index({
  status: 1,
  applied_at: -1,
});

// Provider approved application list
applicationSchema.index({
  provider_id: 1,
  status: 1,
});

// Seeker "My Applications"
applicationSchema.index({
  seeker_id: 1,
  applied_at: -1,
});

// ======================================================
// MODEL
// ======================================================

module.exports = mongoose.model(
  "Application",
  applicationSchema,
);