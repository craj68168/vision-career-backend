const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

// ======================================================
// GENERATE ADMIN ID
//
// ADM-A12B34CD
// ======================================================

const generateAdminId = () => {
  return `ADM-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
};

// ======================================================
// ADMIN SCHEMA
// ======================================================

const adminSchema = new mongoose.Schema(
  {
    // ==================================================
    // ADMIN ID
    // ==================================================

    adminId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      index: true,
      default: generateAdminId,
    },

    // ==================================================
    // USERNAME
    // ==================================================

    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
      minlength: 3,
      maxlength: 100,
    },

    // ==================================================
    // PASSWORD
    // ==================================================

    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },

    // ==================================================
    // ROLE
    // ==================================================

    role: {
      type: String,
      enum: ["admin"],
      default: "admin",
      immutable: true,
    },

    // ==================================================
    // STATUS
    // ==================================================

    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
      index: true,
    },

    // ==================================================
    // LOGIN INFORMATION
    // ==================================================

    lastLoginAt: {
      type: Date,
      default: null,
    },

    // ==================================================
    // PASSWORD SECURITY
    //
    // Used to invalidate JWTs issued before a password
    // change.
    // ==================================================

    passwordChangedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// ======================================================
// HASH PASSWORD
// ======================================================

adminSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 12);
});

// ======================================================
// COMPARE PASSWORD
// ======================================================

adminSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ======================================================
// MODEL
// ======================================================

module.exports = mongoose.model("Admin", adminSchema);
