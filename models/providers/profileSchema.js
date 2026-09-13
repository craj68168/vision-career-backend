const mongoose = require("mongoose");

const phoneRegex = /^[0-9+\-()\s]{7,20}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const websiteRegex = /^https?:\/\/.+/i;

const profileSchema = new mongoose.Schema(
  {
    registerId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

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
        validator: (v) => !v || websiteRegex.test(v),
        message: "Website must start with http:// or https://",
      },
    },

    industry: {
      type: String,
      trim: true,
      default: null,
    },

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

    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Profile", profileSchema);
