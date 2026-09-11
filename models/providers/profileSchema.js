const mongoose = require("mongoose");

const phoneRegex = /^[\d\s\-+()]+$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const websiteRegex = /^https?:\/\/.+/i;

const profileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Change to "ClientCompany" if that is your user model
      required: true,
      unique: true,
      index: true,
    },

    name: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },

    company_name: {
      type: String,
      trim: true,
      default: null,
      minlength: 2,
      maxlength: 100,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      match: [emailRegex, "Please enter a valid email address"],
    },

    phone: {
      type: String,
      trim: true,
      default: null,
      match: [phoneRegex, "Please enter a valid phone number"],
    },

    address: {
      type: String,
      trim: true,
      default: null,
      minlength: 5,
      maxlength: 500,
    },

    website: {
      type: String,
      trim: true,
      default: null,
      validate: {
        validator(value) {
          return !value || websiteRegex.test(value);
        },
        message: "Website must include http:// or https://",
      },
    },

    industry: {
      type: String,
      trim: true,
      default: null,
      maxlength: 100,
    },

    contact_person: {
      type: String,
      trim: true,
      default: null,
      minlength: 2,
      maxlength: 100,
    },

    contact_person_phone: {
      type: String,
      trim: true,
      default: null,
      match: [phoneRegex, "Please enter a valid contact person phone"],
    },

    contact_person_email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
      match: [emailRegex, "Please enter a valid contact person email"],
    },

    hiring_needs: {
      type: String,
      trim: true,
      default: null,
      maxlength: 2000,
    },

    notes: {
      type: String,
      trim: true,
      default: null,
      maxlength: 2000,
    },

    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Profile", profileSchema);