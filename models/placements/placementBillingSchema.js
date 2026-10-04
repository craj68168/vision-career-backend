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
        "REFUND_PROCESSED",
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
// REFUND HISTORY
// ======================================================

const refundSchema = new mongoose.Schema(
  {
    refundId: {
      type: String,
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    actor_type: {
      type: String,
      enum: ["admin", "staff"],
      required: true,
    },

    actor_id: {
      type: String,
      required: true,
    },

    refunded_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true,
  },
);

// ======================================================
// INVOICE ISSUER SNAPSHOT
//
// This is our company information at the exact time
// the invoice is issued.
//
// IMPORTANT:
//
// If company information changes later, an old invoice
// must continue showing the original information.
// ======================================================

const invoiceIssuerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: "",
      trim: true,
    },

    postalCode: {
      type: String,
      default: "",
      trim: true,
    },

    address: {
      type: String,
      default: "",
      trim: true,
    },

    phone: {
      type: String,
      default: "",
      trim: true,
    },

    email: {
      type: String,
      default: "",
      trim: true,
    },

    registrationNumber: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    _id: false,
  },
);

// ======================================================
// INVOICE RECIPIENT SNAPSHOT
//
// Provider/company information at issue time.
// ======================================================

const invoiceRecipientSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      default: "",
      trim: true,
    },

    address: {
      type: String,
      default: "",
      trim: true,
    },

    contactPerson: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    _id: false,
  },
);

// ======================================================
// BANK TRANSFER SNAPSHOT
//
// Bank information at issue time.
//
// IMPORTANT:
//
// This is a display/instruction snapshot only.
// It does NOT connect to the bank and does NOT
// automatically transfer money.
// ======================================================

const invoiceBankSchema = new mongoose.Schema(
  {
    bankName: {
      type: String,
      default: "",
      trim: true,
    },

    branchName: {
      type: String,
      default: "",
      trim: true,
    },

    accountType: {
      type: String,
      default: "",
      trim: true,
    },

    accountNumber: {
      type: String,
      default: "",
      trim: true,
    },

    accountHolder: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    _id: false,
  },
);

// ======================================================
// COMPLETE INVOICE SNAPSHOT
// ======================================================

const invoiceSnapshotSchema = new mongoose.Schema(
  {
    issuer: {
      type: invoiceIssuerSchema,
      default: () => ({}),
    },

    recipient: {
      type: invoiceRecipientSchema,
      default: () => ({}),
    },

    bank: {
      type: invoiceBankSchema,
      default: () => ({}),
    },

    serviceDescription: {
      type: String,
      default: "人材紹介手数料",
      trim: true,
    },

    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  {
    _id: false,
  },
);

// ======================================================
// PLACEMENT BILLING
// ======================================================

const placementBillingSchema = new mongoose.Schema(
  {
    // ==================================================
    // IDENTIFIERS
    // ==================================================

    billingId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
    },

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

    seekerId: {
      type: String,
      required: true,
      index: true,
    },

    // ==================================================
    // PLACEMENT SNAPSHOT
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
    // BILLING
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
    // INVOICE
    //
    // Created when DRAFT -> ISSUED.
    //
    // billingId:
    // Internal billing identifier.
    //
    // invoiceNumber:
    // Customer-facing invoice number.
    //
    // invoiceSnapshot:
    // Frozen issuer / customer / bank information.
    // ==================================================

    invoiceNumber: {
      type: String,
      default: null,
      trim: true,
    },

    invoiceSnapshot: {
      type: invoiceSnapshotSchema,
      default: null,
    },

    // ==================================================
    // PAYMENT
    // ==================================================

    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    refundedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    netPaidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ==================================================
    // STATUS
    // ==================================================

    status: {
      type: String,
      enum: [
        "draft",
        "issued",
        "paid",
        "partially_refunded",
        "refunded",
        "cancelled",
      ],
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

    fullyRefundedAt: {
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

    // ==================================================
    // HISTORY
    // ==================================================

    refundHistory: {
      type: [refundSchema],
      default: [],
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
// INVOICE NUMBER INDEX
//
// IMPORTANT:
//
// Draft billings intentionally have:
//
// invoiceNumber: null
//
// Multiple drafts must therefore be allowed.
//
// Only real customer-facing invoice numbers are indexed
// by the uniqueness constraint.
//
// Examples:
//
// null                      -> allowed many times
// INV-20261004-AAAA1111     -> unique
// INV-20261004-BBBB2222     -> unique
//
// A duplicate real invoice number is rejected.
// ======================================================

placementBillingSchema.index(
  {
    invoiceNumber: 1,
  },
  {
    name: "invoiceNumber_1",
    unique: true,

    partialFilterExpression: {
      invoiceNumber: {
        $type: "string",
      },
    },
  },
);

// ======================================================
// RECALCULATE FINANCIAL VALUES
// ======================================================

placementBillingSchema.pre("validate", function () {
  const fee = Number(this.placementFee || 0);

  const taxRate = Number(this.taxRate || 0);

  const tax =
    this.currency === "JPY"
      ? Math.round(fee * (taxRate / 100))
      : Math.round(fee * (taxRate / 100) * 100) / 100;

  const total =
    this.currency === "JPY"
      ? Math.round(fee + tax)
      : Math.round((fee + tax) * 100) / 100;

  this.taxAmount = tax;

  this.totalAmount = total;

  const paid = Number(this.paidAmount || 0);

  const refunded = Number(this.refundedAmount || 0);

  const netPaid =
    this.currency === "JPY"
      ? Math.round(Math.max(paid - refunded, 0))
      : Math.round(Math.max(paid - refunded, 0) * 100) / 100;

  this.netPaidAmount = netPaid;
});

// ======================================================
// MODEL
// ======================================================

module.exports = mongoose.model("PlacementBilling", placementBillingSchema);
