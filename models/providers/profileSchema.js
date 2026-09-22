const mongoose = require("mongoose");

// ======================================================
// VALIDATION
// ======================================================

const phoneRegex = /^[0-9+\-()\s]{7,20}$/;

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const websiteRegex = /^https?:\/\/.+/i;

// ======================================================
// PROFILE SCHEMA
// ======================================================

const profileSchema = new mongoose.Schema(
  {
    // ==================================================
    // PROVIDER IDENTIFIER
    // ==================================================

    registerId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // ==================================================
    // BASIC INFORMATION
    // ==================================================

    name: {
      type: String,
      trim: true,
      default: "",
    },

    company_name: {
      type: String,
      trim: true,
      default: null,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      match: [emailRegex, "Invalid email"],
    },

    phone: {
      type: String,
      trim: true,
      default: null,
      match: [phoneRegex, "Invalid phone"],
    },

    // ==================================================
    // COMPANY INFORMATION
    // ==================================================

    address: {
      type: String,
      trim: true,
      default: null,
    },

    website: {
      type: String,
      trim: true,
      default: null,

      validate: {
        validator: (value) => {
          return !value || websiteRegex.test(value);
        },

        message: "Website must start with http:// or https://",
      },
    },

    industry: {
      type: String,
      trim: true,
      default: null,
    },

    // ==================================================
    // CONTACT PERSON
    // ==================================================

    contact_person: {
      type: String,
      trim: true,
      default: null,
    },

    contact_person_phone: {
      type: String,
      trim: true,
      default: null,
      match: [phoneRegex, "Invalid phone"],
    },

    contact_person_email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
      match: [emailRegex, "Invalid email"],
    },

    // ==================================================
    // HIRING INFORMATION
    // ==================================================

    hiring_needs: {
      type: String,
      trim: true,
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      default: null,
    },

    // ==================================================
    // ACCOUNT STATUS
    //
    // ADMIN CONTROLS THIS.
    // ==================================================

    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
      index: true,
    },

    // ==================================================
    // STAFF OPERATIONAL REVIEW
    //
    // Staff review does NOT modify account status.
    // Admin remains responsible for account authority.
    // ==================================================

    staff_review_status: {
      type: String,
      enum: ["NOT_REVIEWED", "REVIEWED", "NEEDS_ATTENTION"],
      default: "NOT_REVIEWED",
      index: true,
    },

    staff_review_note: {
      type: String,
      trim: true,
      default: null,
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
// MODEL
// ======================================================

module.exports = mongoose.model("Profile", profileSchema);
