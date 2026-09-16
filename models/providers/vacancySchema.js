const mongoose = require("mongoose");

const vacancySchema = new mongoose.Schema(
  {
    // ==================================================
    // IDS / OWNERSHIP
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
    // COMPANY INFORMATION
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
    // POSITION DETAILS
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
      min: 1,
      default: 1,
    },

    // ==================================================
    // JOB DESCRIPTION
    // ==================================================

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

    // ==================================================
    // REQUIREMENTS
    // ==================================================

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
    // LOCATION / SALARY
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

    salaryMin: {
      type: Number,
      default: null,
    },

    salaryMax: {
      type: Number,
      default: null,
    },

    salaryNote: {
      type: String,
      default: null,
      trim: true,
    },

    // ==================================================
    // SCHEDULE
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

    // ==================================================
    // BENEFITS
    // ==================================================

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
    // APPLICATION
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
    // CONTACT PERSON
    //
    // PRIVATE:
    // NEVER expose this in public seeker API.
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
    // REVIEW
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
    },

    isPublished: {
      type: Boolean,
      default: false,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    rejectionReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Vacancy", vacancySchema);
