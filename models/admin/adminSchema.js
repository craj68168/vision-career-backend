const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

// ======================================================
// GENERATE ADMIN ID
// Example:
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
    adminId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      index: true,
      default: generateAdminId,
    },

    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },

    role: {
      type: String,
      enum: ["admin"],
      default: "admin",
      immutable: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
      index: true,
    },

    lastLoginAt: {
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
