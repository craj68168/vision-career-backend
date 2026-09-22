const mongoose = require("mongoose");

// ======================================================
// VACANCY SCHEMA
// ======================================================

const vacancySchema = new mongoose.Schema(
  {
    // ==================================================
    // IDENTIFIERS
    // ==================================================

    vacancyId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    registerId: {
      type: String,
      required: true,
      index: true,
    },

    // ==================================================
    // COMPANY
    // ==================================================

    companyName: {
      type: String,
      required: true,
      trim: true,
    },

    companyNameKana: {
      type: String,
      default: null,
      trim: true,
    },

    // ==================================================
    // JOB INFORMATION
    // ==================================================

    title: {
      type: String,
      required: true,
      trim: true,
    },

    titleKana: {
      type: String,
      default: null,
      trim: true,
    },

    employmentType: {
      type: String,
      required: true,
      trim: true,
    },

    numberOfPeople: {
      type: Number,
      default: 1,
      min: 1,
    },

    jobDescription: {
      type: String,
      required: true,
      trim: true,
    },

    responsibilities: {
      type: String,
      default: null,
      trim: true,
    },

    requiredSkills: {
      type: String,
      default: null,
      trim: true,
    },

    preferredSkills: {
      type: String,
      default: null,
      trim: true,
    },

    requiredEducation: {
      type: String,
      default: null,
      trim: true,
    },

    requiredExperience: {
      type: String,
      default: null,
      trim: true,
    },

    japaneseLevel: {
      type: String,
      default: null,
      trim: true,
    },

    // ==================================================
    // WORK LOCATION
    // ==================================================

    workLocation: {
      type: String,
      required: true,
      trim: true,
    },

    workLocationDetail: {
      type: String,
      default: null,
      trim: true,
    },

    remoteWork: {
      type: String,
      default: null,
      trim: true,
    },

    // ==================================================
    // SALARY
    // ==================================================

    salaryMin: {
      type: Number,
      default: null,
      min: 0,
    },

    salaryMax: {
      type: Number,
      default: null,
      min: 0,
    },

    salaryNote: {
      type: String,
      default: null,
      trim: true,
    },

    // ==================================================
    // WORK CONDITIONS
    // ==================================================

    workHours: {
      type: String,
      default: null,
      trim: true,
    },

    breakTime: {
      type: String,
      default: null,
      trim: true,
    },

    overtime: {
      type: String,
      default: null,
      trim: true,
    },

    holidays: {
      type: String,
      default: null,
      trim: true,
    },

    benefits: {
      type: [String],
      default: [],
    },

    insurance: {
      type: [String],
      default: [],
    },

    trialPeriod: {
      type: String,
      default: null,
      trim: true,
    },

    // ==================================================
    // DATES / SELECTION
    // ==================================================

    applicationDeadline: {
      type: Date,
      default: null,
    },

    startDate: {
      type: String,
      default: null,
      trim: true,
    },

    selectionProcess: {
      type: String,
      default: null,
      trim: true,
    },

    // ==================================================
    // PRIVATE PROVIDER CONTACT
    // ==================================================

    contactPerson: {
      type: String,
      required: true,
      trim: true,
    },

    contactPersonKana: {
      type: String,
      default: null,
      trim: true,
    },

    contactEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    // ==================================================
    // VACANCY WORKFLOW
    // ==================================================

    status: {
      type: String,
      enum: [
        "draft",
        "pending_review",
        "approved",
        "rejected",
        "published",
        "closed",
      ],
      default: "pending_review",
      index: true,
    },

    isPublished: {
      type: Boolean,
      default: false,
      index: true,
    },

    reviewedAt: {
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
    // STAFF SCREENING
    //
    // IMPORTANT:
    //
    // Staff screening does NOT change vacancy.status.
    //
    // Staff only prepares information for Admin.
    // ==================================================

    staff_screening_status: {
      type: String,
      enum: ["NOT_SCREENED", "SCREENED", "NEEDS_ATTENTION"],
      default: "NOT_SCREENED",
      index: true,
    },

    staff_screening_note: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2000,
    },

    screened_by_staff_id: {
      type: String,
      default: null,
      index: true,
    },

    screened_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// ======================================================
// INDEXES
// ======================================================

vacancySchema.index({
  registerId: 1,
  createdAt: -1,
});

vacancySchema.index({
  status: 1,
  isPublished: 1,
});

module.exports = mongoose.model("Vacancy", vacancySchema);
