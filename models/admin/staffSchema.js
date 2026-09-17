const mongoose = require("mongoose");

const StaffCounter = require("./staffCounterSchema");

const { STAFF_PERMISSIONS } = require("../../config/staffPermissions");

// ======================================================
// STAFF SCHEMA
// ======================================================

const staffSchema = new mongoose.Schema(
  {
    // ==================================================
    // STAFF ID
    // ==================================================

    staffId: {
      type: String,
      unique: true,
      index: true,
      immutable: true,
    },

    // ==================================================
    // BASIC INFORMATION
    // ==================================================

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    phone: {
      type: String,
      default: null,
      trim: true,
    },

    // ==================================================
    // ROLE
    // ==================================================

    role: {
      type: String,
      enum: ["staff"],
      default: "staff",
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
    // PERMISSIONS
    // ==================================================

    permissions: {
      type: [
        {
          type: String,
          enum: STAFF_PERMISSIONS,
        },
      ],
      default: [],
    },

    // ==================================================
    // CREATED BY ADMIN
    // ==================================================

    createdByAdminId: {
      type: String,
      required: true,
      index: true,
    },

    // ==================================================
    // LOGIN INFORMATION
    // ==================================================

    lastLoginAt: {
      type: Date,
      default: null,
    },

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
// AUTO STAFF ID
//
// STF-000001
// STF-000002
// ======================================================

staffSchema.pre("save", async function () {
  if (this.staffId) {
    return;
  }

  const counter = await StaffCounter.findByIdAndUpdate(
    {
      _id: "staffId",
    },
    {
      $inc: {
        seq: 1,
      },
    },
    {
      new: true,
      upsert: true,
    },
  );

  this.staffId = `STF-${counter.seq.toString().padStart(6, "0")}`;
});

module.exports = mongoose.model("Staff", staffSchema);
