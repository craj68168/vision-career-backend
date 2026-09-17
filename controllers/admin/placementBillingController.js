const crypto = require("crypto");

const PlacementBilling = require("../../models/placements/placementBillingSchema");

const {
  ensureAllPlacedBillings,
} = require("../../utils/ensurePlacementBilling");

// ======================================================
// MONEY HELPER
// ======================================================

const roundMoney = (value) => {
  return Math.round(Number(value || 0) * 100) / 100;
};

// ======================================================
// REFUND ID GENERATOR
// ======================================================

const generateRefundId = () => {
  return `RF-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
};

// ======================================================
// NORMALIZE LEGACY PAYMENT FIELDS
//
// IMPORTANT:
//
// Some existing billings were marked PAID before these
// fields existed:
//
// paidAmount
// refundedAmount
// netPaidAmount
//
// Example:
//
// totalAmount: 330000
// status: "paid"
// paidAmount: 0
//
// This function safely repairs those old records.
//
// It DOES NOT remove or rewrite audit history.
// ======================================================

const normalizeLegacyPaymentFields = async (billing) => {
  const paymentStatuses = ["paid", "partially_refunded", "refunded"];

  if (!paymentStatuses.includes(billing.status)) {
    return billing;
  }

  const totalAmount = Number(billing.totalAmount || 0);

  const currentPaidAmount = Number(billing.paidAmount || 0);

  const refundedAmount = Number(billing.refundedAmount || 0);

  let changed = false;

  // ====================================================
  // OLD PAID RECORD
  // ====================================================

  if (currentPaidAmount <= 0 && totalAmount > 0) {
    billing.paidAmount = totalAmount;

    changed = true;
  }

  // ====================================================
  // CORRECT NET PAID
  // ====================================================

  const effectivePaidAmount = Number(billing.paidAmount || totalAmount || 0);

  const correctNetPaidAmount = roundMoney(
    Math.max(effectivePaidAmount - refundedAmount, 0),
  );

  if (Number(billing.netPaidAmount || 0) !== correctNetPaidAmount) {
    billing.netPaidAmount = correctNetPaidAmount;

    changed = true;
  }

  // ====================================================
  // CORRECT STATUS IF NECESSARY
  // ====================================================

  if (
    refundedAmount > 0 &&
    correctNetPaidAmount > 0 &&
    billing.status !== "partially_refunded"
  ) {
    billing.status = "partially_refunded";

    changed = true;
  }

  if (
    effectivePaidAmount > 0 &&
    refundedAmount >= effectivePaidAmount &&
    billing.status !== "refunded"
  ) {
    billing.status = "refunded";

    if (!billing.fullyRefundedAt) {
      billing.fullyRefundedAt = new Date();
    }

    changed = true;
  }

  // ====================================================
  // SAVE ONLY WHEN NEEDED
  // ====================================================

  if (changed) {
    await billing.save();
  }

  return billing;
};

// ======================================================
// SERIALIZER
// ======================================================

const serializeBilling = (billing) => {
  return {
    billingId: billing.billingId,

    placementCandidateId: billing.placementCandidateId,

    recruitId: billing.recruitId,

    providerId: billing.providerId,

    companyName: billing.companyName,

    candidateName: billing.candidateName,

    jobTitle: billing.jobTitle,

    placementDate: billing.placementDate,

    currency: billing.currency,

    placementFee: Number(billing.placementFee || 0),

    taxRate: Number(billing.taxRate || 0),

    taxAmount: Number(billing.taxAmount || 0),

    totalAmount: Number(billing.totalAmount || 0),

    dueDate: billing.dueDate,

    // ==================================================
    // PAYMENT
    // ==================================================

    paidAmount: Number(billing.paidAmount || 0),

    refundedAmount: Number(billing.refundedAmount || 0),

    netPaidAmount: Number(billing.netPaidAmount || 0),

    // ==================================================
    // STATUS
    // ==================================================

    status: billing.status,

    issuedAt: billing.issuedAt,

    paidAt: billing.paidAt,

    cancelledAt: billing.cancelledAt,

    fullyRefundedAt: billing.fullyRefundedAt,

    cancellationReason: billing.cancellationReason,

    notes: billing.notes,

    refundHistory: billing.refundHistory || [],

    auditHistory: billing.auditHistory || [],

    createdAt: billing.createdAt,

    updatedAt: billing.updatedAt,
  };
};

// ======================================================
// GET ALL PLACEMENT BILLINGS
//
// GET /api/admin/placement-billings
// ======================================================

exports.getPlacementBillings = async (req, res) => {
  try {
    // ==================================================
    // CREATE BILLINGS FOR EXISTING PLACED CANDIDATES
    // ==================================================

    await ensureAllPlacedBillings();

    // ==================================================
    // FETCH
    // ==================================================

    const billings = await PlacementBilling.find().sort({
      createdAt: -1,
    });

    // ==================================================
    // REPAIR LEGACY RECORDS
    // ==================================================

    for (const billing of billings) {
      await normalizeLegacyPaymentFields(billing);
    }

    // ==================================================
    // SERIALIZE
    // ==================================================

    const data = billings.map(serializeBilling);

    // ==================================================
    // BILLABLE STATUSES
    //
    // Draft is not yet officially billed.
    // Cancelled is removed from financial billing totals.
    // ==================================================

    const billableStatuses = [
      "issued",
      "paid",
      "partially_refunded",
      "refunded",
    ];

    // ==================================================
    // TOTAL BILLED
    // ==================================================

    const billedTotal = data
      .filter((item) => billableStatuses.includes(item.status))
      .reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);

    // ==================================================
    // NET PAID
    //
    // Original paid minus refunds.
    // ==================================================

    const paidTotal = data.reduce(
      (sum, item) => sum + Number(item.netPaidAmount || 0),
      0,
    );

    // ==================================================
    // REFUNDED
    // ==================================================

    const refundedTotal = data.reduce(
      (sum, item) => sum + Number(item.refundedAmount || 0),
      0,
    );

    // ==================================================
    // OUTSTANDING
    //
    // Currently only issued/unpaid bills.
    // ==================================================

    const outstandingTotal = data
      .filter((item) => item.status === "issued")
      .reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);

    // ==================================================
    // RESPONSE
    // ==================================================

    return res.status(200).json({
      success: true,

      count: data.length,

      summary: {
        total: data.length,

        draft: data.filter((item) => item.status === "draft").length,

        issued: data.filter((item) => item.status === "issued").length,

        paid: data.filter((item) => item.status === "paid").length,

        partiallyRefunded: data.filter(
          (item) => item.status === "partially_refunded",
        ).length,

        refunded: data.filter((item) => item.status === "refunded").length,

        cancelled: data.filter((item) => item.status === "cancelled").length,

        billedTotal: roundMoney(billedTotal),

        paidTotal: roundMoney(paidTotal),

        refundedTotal: roundMoney(refundedTotal),

        outstandingTotal: roundMoney(outstandingTotal),
      },

      data,
    });
  } catch (error) {
    console.error("GET PLACEMENT BILLINGS ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load placement billings.",
    });
  }
};

// ======================================================
// GET ONE BILLING
//
// GET /api/admin/placement-billings/:billingId
// ======================================================

exports.getPlacementBillingById = async (req, res) => {
  try {
    const billing = await PlacementBilling.findOne({
      billingId: req.params.billingId,
    });

    if (!billing) {
      return res.status(404).json({
        success: false,

        message: "Placement billing not found.",
      });
    }

    // =================================================
    // REPAIR OLD PAYMENT RECORD IF REQUIRED
    // =================================================

    await normalizeLegacyPaymentFields(billing);

    return res.status(200).json({
      success: true,

      data: serializeBilling(billing),
    });
  } catch (error) {
    console.error("GET PLACEMENT BILLING ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load placement billing.",
    });
  }
};

// ======================================================
// UPDATE DRAFT BILLING
//
// PATCH /api/admin/placement-billings/:billingId
// ======================================================

exports.updatePlacementBilling = async (req, res) => {
  try {
    const billing = await PlacementBilling.findOne({
      billingId: req.params.billingId,
    });

    if (!billing) {
      return res.status(404).json({
        success: false,

        message: "Placement billing not found.",
      });
    }

    // =================================================
    // ONLY DRAFT CAN BE EDITED
    // =================================================

    if (billing.status !== "draft") {
      return res.status(409).json({
        success: false,

        message: "Only draft billings can be edited.",
      });
    }

    const { placementFee, taxRate, dueDate, notes } = req.body;

    // =================================================
    // PLACEMENT FEE
    // =================================================

    if (placementFee !== undefined) {
      const amount = Number(placementFee);

      if (!Number.isFinite(amount) || amount < 0) {
        return res.status(400).json({
          success: false,

          message: "Invalid placement fee.",
        });
      }

      billing.placementFee = amount;
    }

    // =================================================
    // TAX RATE
    // =================================================

    if (taxRate !== undefined) {
      const rate = Number(taxRate);

      if (!Number.isFinite(rate) || rate < 0) {
        return res.status(400).json({
          success: false,

          message: "Invalid tax rate.",
        });
      }

      billing.taxRate = rate;
    }

    // =================================================
    // DUE DATE
    // =================================================

    if (dueDate) {
      const parsedDueDate = new Date(dueDate);

      if (Number.isNaN(parsedDueDate.getTime())) {
        return res.status(400).json({
          success: false,

          message: "Invalid due date.",
        });
      }

      billing.dueDate = parsedDueDate;
    } else {
      billing.dueDate = null;
    }

    // =================================================
    // NOTES
    // =================================================

    billing.notes = notes ? String(notes).trim() : null;

    // =================================================
    // AUDIT
    // =================================================

    billing.auditHistory.push({
      action: "UPDATED",

      actor_type: "admin",

      actor_id: req.admin.adminId,

      details: {
        placementFee: billing.placementFee,

        taxRate: billing.taxRate,

        dueDate: billing.dueDate,
      },
    });

    await billing.save();

    return res.status(200).json({
      success: true,

      message: "Placement billing updated.",

      data: serializeBilling(billing),
    });
  } catch (error) {
    console.error("UPDATE PLACEMENT BILLING ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to update placement billing.",
    });
  }
};

// ======================================================
// ISSUE BILLING
//
// DRAFT → ISSUED
//
// PATCH /api/admin/placement-billings/:billingId/issue
// ======================================================

exports.issuePlacementBilling = async (req, res) => {
  try {
    const billing = await PlacementBilling.findOne({
      billingId: req.params.billingId,
    });

    if (!billing) {
      return res.status(404).json({
        success: false,

        message: "Placement billing not found.",
      });
    }

    if (billing.status !== "draft") {
      return res.status(409).json({
        success: false,

        message: "Only draft billings can be issued.",
      });
    }

    if (Number(billing.totalAmount || 0) <= 0) {
      return res.status(400).json({
        success: false,

        message: "Set the placement fee before issuing the billing.",
      });
    }

    billing.status = "issued";

    billing.issuedAt = new Date();

    billing.auditHistory.push({
      action: "ISSUED",

      actor_type: "admin",

      actor_id: req.admin.adminId,

      details: {
        totalAmount: billing.totalAmount,
      },
    });

    await billing.save();

    return res.status(200).json({
      success: true,

      message: "Placement billing issued.",

      data: serializeBilling(billing),
    });
  } catch (error) {
    console.error("ISSUE PLACEMENT BILLING ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to issue placement billing.",
    });
  }
};

// ======================================================
// MARK BILLING PAID
//
// ISSUED → PAID
//
// PATCH /api/admin/placement-billings/:billingId/paid
// ======================================================

exports.markPlacementBillingPaid = async (req, res) => {
  try {
    const billing = await PlacementBilling.findOne({
      billingId: req.params.billingId,
    });

    if (!billing) {
      return res.status(404).json({
        success: false,

        message: "Placement billing not found.",
      });
    }

    if (billing.status !== "issued") {
      return res.status(409).json({
        success: false,

        message: "Only issued billings can be marked as paid.",
      });
    }

    const totalAmount = roundMoney(billing.totalAmount);

    if (totalAmount <= 0) {
      return res.status(400).json({
        success: false,

        message: "Billing total must be greater than 0.",
      });
    }

    // =================================================
    // PAYMENT VALUES
    // =================================================

    billing.status = "paid";

    billing.paidAt = new Date();

    billing.paidAmount = totalAmount;

    billing.refundedAmount = 0;

    billing.netPaidAmount = totalAmount;

    billing.fullyRefundedAt = null;

    // =================================================
    // AUDIT
    // =================================================

    billing.auditHistory.push({
      action: "MARKED_PAID",

      actor_type: "admin",

      actor_id: req.admin.adminId,

      details: {
        amount: totalAmount,
      },
    });

    await billing.save();

    return res.status(200).json({
      success: true,

      message: "Placement billing marked as paid.",

      data: serializeBilling(billing),
    });
  } catch (error) {
    console.error("MARK BILLING PAID ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to mark placement billing as paid.",
    });
  }
};

// ======================================================
// CANCEL BILLING
//
// DRAFT / ISSUED → CANCELLED
//
// Paid billing CANNOT simply be cancelled.
// Paid billing must use REFUND.
//
// PATCH /api/admin/placement-billings/:billingId/cancel
// ======================================================

exports.cancelPlacementBilling = async (req, res) => {
  try {
    const reason = String(req.body.reason || "").trim();

    if (!reason) {
      return res.status(400).json({
        success: false,

        message: "Cancellation reason is required.",
      });
    }

    if (reason.length > 1000) {
      return res.status(400).json({
        success: false,

        message: "Cancellation reason cannot exceed 1000 characters.",
      });
    }

    const billing = await PlacementBilling.findOne({
      billingId: req.params.billingId,
    });

    if (!billing) {
      return res.status(404).json({
        success: false,

        message: "Placement billing not found.",
      });
    }

    if (!["draft", "issued"].includes(billing.status)) {
      return res.status(409).json({
        success: false,

        message: "Only draft or issued billings can be cancelled.",
      });
    }

    billing.status = "cancelled";

    billing.cancelledAt = new Date();

    billing.cancellationReason = reason;

    billing.auditHistory.push({
      action: "CANCELLED",

      actor_type: "admin",

      actor_id: req.admin.adminId,

      reason,

      details: {
        previousStatus: billing.status,
      },
    });

    await billing.save();

    return res.status(200).json({
      success: true,

      message: "Placement billing cancelled.",

      data: serializeBilling(billing),
    });
  } catch (error) {
    console.error("CANCEL PLACEMENT BILLING ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to cancel placement billing.",
    });
  }
};

// ======================================================
// PROCESS REFUND
//
// PAID
//   ↓
//
// PARTIAL REFUND
//   ↓
// PARTIALLY_REFUNDED
//
// OR:
//
// FULL REFUND
//   ↓
// REFUNDED
//
// PATCH
// /api/admin/placement-billings/:billingId/refund
//
// BODY:
//
// {
//   "amount": 30000,
//   "reason": "Client requested refund"
// }
// ======================================================

exports.refundPlacementBilling = async (req, res) => {
  try {
    // =================================================
    // INPUT
    // =================================================

    const amount = Number(req.body.amount);

    const reason = String(req.body.reason || "").trim();

    // =================================================
    // VALIDATE AMOUNT
    // =================================================

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,

        message: "Refund amount must be greater than 0.",
      });
    }

    // =================================================
    // VALIDATE REASON
    // =================================================

    if (!reason) {
      return res.status(400).json({
        success: false,

        message: "Refund reason is required.",
      });
    }

    if (reason.length > 1000) {
      return res.status(400).json({
        success: false,

        message: "Refund reason cannot exceed 1000 characters.",
      });
    }

    // =================================================
    // FIND BILLING
    // =================================================

    const billing = await PlacementBilling.findOne({
      billingId: req.params.billingId,
    });

    if (!billing) {
      return res.status(404).json({
        success: false,

        message: "Placement billing not found.",
      });
    }

    // =================================================
    // ALLOWED STATUSES
    // =================================================

    if (!["paid", "partially_refunded"].includes(billing.status)) {
      return res.status(409).json({
        success: false,

        message: "Only paid or partially refunded billings can be refunded.",
      });
    }

    // =================================================
    // ORIGINAL PAID AMOUNT
    //
    // Legacy fallback:
    //
    // If paidAmount is 0 but this is an old paid record,
    // totalAmount becomes the original payment.
    // =================================================

    const paidAmount = roundMoney(
      Number(billing.paidAmount || billing.totalAmount || 0),
    );

    if (paidAmount <= 0) {
      return res.status(400).json({
        success: false,

        message: "This billing has no recorded payment to refund.",
      });
    }

    // =================================================
    // IMPORTANT LEGACY FIX
    //
    // Persist the fallback into the document before save.
    //
    // Otherwise schema pre-validation could see:
    //
    // paidAmount = 0
    // refundedAmount = 30000
    //
    // and incorrectly calculate netPaidAmount = 0.
    // =================================================

    if (Number(billing.paidAmount || 0) <= 0) {
      billing.paidAmount = paidAmount;
    }

    // =================================================
    // EXISTING REFUNDS
    // =================================================

    const alreadyRefunded = roundMoney(Number(billing.refundedAmount || 0));

    // =================================================
    // AVAILABLE REFUND AMOUNT
    // =================================================

    const refundableAmount = roundMoney(
      Math.max(paidAmount - alreadyRefunded, 0),
    );

    if (refundableAmount <= 0) {
      return res.status(409).json({
        success: false,

        message: "This billing has already been fully refunded.",
      });
    }

    // =================================================
    // NORMALIZE REQUESTED REFUND
    // =================================================

    const normalizedAmount = roundMoney(amount);

    if (normalizedAmount > refundableAmount) {
      return res.status(400).json({
        success: false,

        message: `Refund cannot exceed the remaining refundable amount of ¥${refundableAmount.toLocaleString()}.`,
      });
    }

    // =================================================
    // NEW FINANCIAL TOTALS
    // =================================================

    const newRefundedAmount = roundMoney(alreadyRefunded + normalizedAmount);

    const newNetPaidAmount = roundMoney(
      Math.max(paidAmount - newRefundedAmount, 0),
    );

    const isFullyRefunded = newNetPaidAmount <= 0;

    // =================================================
    // CREATE REFUND RECORD
    // =================================================

    const refundId = generateRefundId();

    const refundDate = new Date();

    billing.refundHistory.push({
      refundId,

      amount: normalizedAmount,

      reason,

      actor_type: "admin",

      actor_id: req.admin.adminId,

      refunded_at: refundDate,
    });

    // =================================================
    // UPDATE BILLING TOTALS
    // =================================================

    billing.refundedAmount = newRefundedAmount;

    billing.netPaidAmount = newNetPaidAmount;

    // =================================================
    // STATUS
    // =================================================

    if (isFullyRefunded) {
      billing.status = "refunded";

      billing.fullyRefundedAt = refundDate;
    } else {
      billing.status = "partially_refunded";

      billing.fullyRefundedAt = null;
    }

    // =================================================
    // AUDIT
    // =================================================

    billing.auditHistory.push({
      action: "REFUND_PROCESSED",

      actor_type: "admin",

      actor_id: req.admin.adminId,

      reason,

      details: {
        refundId,

        refundAmount: normalizedAmount,

        originalPaidAmount: paidAmount,

        previousRefundedAmount: alreadyRefunded,

        totalRefunded: newRefundedAmount,

        netPaid: newNetPaidAmount,

        refundType: isFullyRefunded ? "full" : "partial",
      },
    });

    // =================================================
    // SAVE
    // =================================================

    await billing.save();

    // =================================================
    // RESPONSE
    // =================================================

    return res.status(200).json({
      success: true,

      message: isFullyRefunded
        ? "Billing fully refunded."
        : "Partial refund processed successfully.",

      data: serializeBilling(billing),
    });
  } catch (error) {
    console.error("REFUND PLACEMENT BILLING ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to process refund.",
    });
  }
};
