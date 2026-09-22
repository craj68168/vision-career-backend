const mongoose = require("mongoose");

// ======================================================
// EDUCATION SNAPSHOT
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
    },

    school: {
      type: String,
      default: null,
    },

    major: {
      type: String,
      default: null,
    },
  },
  {
    _id: false,
  },
);

// ======================================================
// EMPLOYMENT SNAPSHOT
// ======================================================

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
    },

    company_name: {
      type: String,
      default: null,
    },
  },
  {
    _id: false,
  },
);

// ======================================================
// SAFE CANDIDATE SNAPSHOT
//
// IMPORTANT:
//
// Do NOT store:
//
// email
// phone
// address
// private documents
// profile photo
// resume file path
//
// Provider must not receive direct/private contact data.
// ======================================================

const candidateSnapshotSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    nationality: {
      type: String,
      default: null,
    },

    current_location: {
      type: String,
      default: null,
    },

    visa_type: {
      type: String,
      default: null,
    },

    visa_expiry_date: {
      type: Date,
      default: null,
    },

    japanese_level: {
      type: String,
      default: null,
    },

    skills: {
      type: [String],
      default: [],
    },

    desired_job: {
      type: String,
      default: null,
    },

    desired_location: {
      type: String,
      default: null,
    },

    education: {
      type: [educationSnapshotSchema],
      default: [],
    },

    employment_history: {
      type: [employmentSnapshotSchema],
      default: [],
    },
  },
  {
    _id: false,
  },
);

// ======================================================
// MAIN PLACEMENT CANDIDATE
// ======================================================

const placementCandidateSchema = new mongoose.Schema(
  {
    // ==================================================
    // IDENTIFIERS
    // ==================================================

    placementCandidateId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
    },

    recruitId: {
      type: String,
      required: true,
      index: true,
    },

    // Provider registerId
    providerId: {
      type: String,
      required: true,
      index: true,
    },

    // Internal only.
    //
    // Provider serializer MUST NOT expose this.
    seekerId: {
      type: String,
      required: true,
      index: true,
    },

    matchedByAdminId: {
      type: String,
      required: true,
    },

    // ==================================================
    // SAFE SNAPSHOT
    // ==================================================

    candidate_snapshot: {
      type: candidateSnapshotSchema,
      required: true,
    },

    // ==================================================
    // PROVIDER PIPELINE STATUS
    //
    // Staff review must NEVER modify this.
    // ==================================================

    status: {
      type: String,

      enum: [
        "MATCHED",
        "UNDER_REVIEW",
        "INTERVIEW",
        "SELECTED",
        "PLACED",
        "REJECTED",
      ],

      default: "MATCHED",

      index: true,
    },

    // ==================================================
    // PIPELINE TIMESTAMPS
    // ==================================================

    matchedAt: {
      type: Date,
      default: Date.now,
    },

    providerReviewedAt: {
      type: Date,
      default: null,
    },

    interviewAt: {
      type: Date,
      default: null,
    },

    selectedAt: {
      type: Date,
      default: null,
    },

    placedAt: {
      type: Date,
      default: null,
    },

    rejectedAt: {
      type: Date,
      default: null,
    },

    rejectionReason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1000,
    },

    // ==================================================
    // STAFF OPERATIONAL REVIEW
    //
    // Independent from Provider pipeline status.
    //
    // Staff can:
    // REVIEWED
    // NEEDS_ATTENTION
    //
    // Staff cannot:
    // INTERVIEW / SELECTED / PLACED / REJECTED
    // ==================================================

    staff_review_status: {
      type: String,

      enum: ["NOT_REVIEWED", "REVIEWED", "NEEDS_ATTENTION"],

      default: "NOT_REVIEWED",

      index: true,
    },

    staff_review_note: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2000,
    },

    reviewed_by_staff_id: {
      type: String,
      default: null,
      index: true,
    },

    staff_reviewed_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// ======================================================
// PREVENT DUPLICATE MATCH
//
// Same seeker cannot be matched twice to the same
// placement request.
// ======================================================

placementCandidateSchema.index(
  {
    recruitId: 1,
    seekerId: 1,
  },
  {
    unique: true,
  },
);

// ======================================================
// MODEL
// ======================================================

module.exports = mongoose.model("PlacementCandidate", placementCandidateSchema);
