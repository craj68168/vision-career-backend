const mongoose = require("mongoose");

const vacancySchema = new mongoose.Schema(
  {
    // ==========================================
    // UNIQUE VACANCY ID
    // Example: V-734643
    // ==========================================
    vacancyId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    // ==========================================
    // REGISTER ID
    // Multiple vacancies can belong to one register
    // ==========================================
    registerId: {
      type: String,
      required: true,
      index: true
    },

    companyName: {
      type: String,
      required: true,
      trim: true
    },

    companyNameKana: {
      type: String,
      default: ""
    },

    title: {
      type: String,
      required: true,
      trim: true
    },

    titleKana: {
      type: String,
      default: ""
    },

    employmentType: {
      type: String,
      default: ""
    },

    numberOfPeople: {
      type: Number,
      default: 1
    },

    jobDescription: {
      type: String,
      default: ""
    },

    responsibilities: {
      type: String,
      default: ""
    },

    requiredSkills: {
      type: String,
      default: ""
    },

    preferredSkills: {
      type: String,
      default: ""
    },

    requiredEducation: {
      type: String,
      default: ""
    },

    requiredExperience: {
      type: String,
      default: ""
    },

    japaneseLevel: {
      type: String,
      default: ""
    },

    workLocation: {
      type: String,
      default: ""
    },

    workLocationDetail: {
      type: String,
      default: ""
    },

    remoteWork: {
      type: String,
      default: ""
    },

    salaryMin: {
      type: Number,
      default: 300
    },

    salaryMax: {
      type: Number,
      default: 500
    },

    salaryNote: {
      type: String,
      default: ""
    },

    workHours: {
      type: String,
      default: "9:00 - 18:00"
    },

    breakTime: {
      type: String,
      default: "12:00 - 13:00"
    },

    overtime: {
      type: String,
      default: "About 20 hours per month on average"
    },

    holidays: {
      type: String,
      default:
        "Weekends and public holidays, summer vacation, and the year-end/New Year holidays"
    },

    benefits: {
      type: [String],
      default: []
    },

    insurance: {
      type: [String],
      default: []
    },

    trialPeriod: {
      type: String,
      default: "Three months"
    },

    applicationDeadline: {
      type: String,
      default: ""
    },

    startDate: {
      type: String,
      default: ""
    },

    selectionProcess: {
      type: String,
      default:
        "Document screening → First interview → Final interview → Job offer"
    },

    contactPerson: {
      type: String,
      default: ""
    },

    contactPersonKana: {
      type: String,
      default: ""
    },

    contactEmail: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Vacancy", vacancySchema);
