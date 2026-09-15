const mongoose = require("mongoose");

const vacancySchema = new mongoose.Schema(
  {
    vacancyId: {
      type: String,
      unique: true,
      index: true,
    },

    registerId: {
      type: String,
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: [
        "draft",
        "pending_review",
        "approved",
        "rejected",
        "published",
        "closed",
        "expired",
      ],
      default: "draft",
    },

    isPublished: { type: Boolean, default: false },

    reviewedAt: { type: Date, default: null },

    // BASIC FIELDS
    companyName: String,
    companyNameKana: String,
    title: String,
    titleKana: String,

    employmentType: String,
    numberOfPeople: Number,

    jobDescription: String,
    responsibilities: String,

    requiredSkills: String,
    preferredSkills: String,

    requiredEducation: String,
    requiredExperience: String,

    japaneseLevel: String,

    workLocation: String,
    salaryMin: Number,
    salaryMax: Number,

    benefits: [String],
    insurance: [String],

    contactPerson: String,
    contactPersonKana: String,
    contactEmail: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Vacancy", vacancySchema);
