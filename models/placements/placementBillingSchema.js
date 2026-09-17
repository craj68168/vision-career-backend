const mongoose = require("mongoose");

// ======================================================
// AUDIT HISTORY
// ======================================================

const auditSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: [
        "CREATED",
        "UPDATED",
        "ISSUED",
        "MARKED_PAID",
        "CANCELLED",
        "REFUNDED",
      ],
      required: true,
    },

    actor_type: {
      type: String,
      enum: ["system", "admin", "staff"],
      default: "system",
    },

    actor_id: {
      type: String,
      default: null,
    },

    reason: {
      type: String,
      default: null,
      trim: true,
    },

    details: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true,
  },
);

// ======================================================
// PLACEMENT BILLING
// ======================================================

const placementBillingSchema = new mongoose.Schema(
  {
    billingId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
    },

    // One billing for one successful placement.
    placementCandidateId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
    },

    recruitId: {
      type: String,
      required: true,
      index: true,
    },

    providerId: {
      type: String,
      required: true,
      index: true,
    },

    // Internal only.
    seekerId: {
      type: String,
      required: true,
      index: true,
    },

    // ==================================================
    // SNAPSHOT INFORMATION
    // ==================================================

    companyName: {
      type: String,
      required: true,
      trim: true,
    },

    candidateName: {
      type: String,
      required: true,
      trim: true,
    },

    jobTitle: {
      type: String,
      required: true,
      trim: true,
    },

    placementDate: {
      type: Date,
      required: true,
    },

    // ==================================================
    // FINANCIAL
    // ==================================================

    currency: {
      type: String,
      default: "JPY",
      trim: true,
    },

    placementFee: {
      type: Number,
      default: 0,
      min: 0,
    },

    taxRate: {
      type: Number,
      default: 0,
      min: 0,
    },

    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    dueDate: {
      type: Date,
      default: null,
    },

    // ==================================================
    // STATUS
    // ==================================================

    status: {
      type: String,
      enum: ["draft", "issued", "paid", "cancelled", "refunded"],
      default: "draft",
      index: true,
    },

    issuedAt: {
      type: Date,
      default: null,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    refundedAt: {
      type: Date,
      default: null,
    },

    cancellationReason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1000,
    },

    notes: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2000,
    },

    auditHistory: {
      type: [auditSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

// ======================================================
// RECALCULATE FINANCIAL TOTALS
// ======================================================

placementBillingSchema.pre("validate", function () {
  const fee = Number(this.placementFee || 0);
  const taxRate = Number(this.taxRate || 0);

  const tax = Math.round(fee * (taxRate / 100) * 100) / 100;

  const total = Math.round((fee + tax) * 100) / 100;

  this.taxAmount = tax;
  this.totalAmount = total;
});

module.exports = mongoose.model("PlacementBilling", placementBillingSchema);
