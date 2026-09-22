const PlacementBilling = require("../../models/placements/placementBillingSchema");

const {
  ensureAllPlacedBillings,
} = require("../../utils/ensurePlacementBilling");

// ======================================================
// MONEY
// ======================================================

const roundMoney = (value) => {
  return Math.round(Number(value || 0) * 100) / 100;
};

// ======================================================
// LEGACY PAYMENT NORMALIZATION
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

  if (currentPaidAmount <= 0 && totalAmount > 0) {
    billing.paidAmount = totalAmount;

    changed = true;
  }

  const effectivePaidAmount = Number(billing.paidAmount || totalAmount || 0);

  const correctNetPaidAmount = roundMoney(
    Math.max(effectivePaidAmount - refundedAmount, 0),
  );

  if (Number(billing.netPaidAmount || 0) !== correctNetPaidAmount) {
    billing.netPaidAmount = correctNetPaidAmount;

    changed = true;
  }

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

  if (changed) {
    await billing.save();
  }

  return billing;
};

// ======================================================
// SERIALIZER
// ======================================================

const serializeBilling = (billing) => ({
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

  paidAmount: Number(billing.paidAmount || 0),

  refundedAmount: Number(billing.refundedAmount || 0),

  netPaidAmount: Number(billing.netPaidAmount || 0),

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
});

// ======================================================
// SUMMARY
// ======================================================

const buildSummary = (data) => {
  const billableStatuses = ["issued", "paid", "partially_refunded", "refunded"];

  const billedTotal = data
    .filter((item) => billableStatuses.includes(item.status))
    .reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);

  const paidTotal = data.reduce(
    (sum, item) => sum + Number(item.netPaidAmount || 0),
    0,
  );

  const refundedTotal = data.reduce(
    (sum, item) => sum + Number(item.refundedAmount || 0),
    0,
  );

  const outstandingTotal = data
    .filter((item) => item.status === "issued")
    .reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);

  return {
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
  };
};

// ======================================================
// GET ALL
//
// GET /api/staff/placement-billings
// ======================================================

exports.getStaffPlacementBillings = async (req, res) => {
  try {
    // Same compatibility behavior as Admin.
    await ensureAllPlacedBillings();

    const billings = await PlacementBilling.find().sort({
      createdAt: -1,
    });

    for (const billing of billings) {
      await normalizeLegacyPaymentFields(billing);
    }

    const data = billings.map(serializeBilling);

    return res.status(200).json({
      success: true,

      count: data.length,

      summary: buildSummary(data),

      data,
    });
  } catch (error) {
    console.error("GET STAFF PLACEMENT BILLINGS ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load placement billings.",
    });
  }
};

// ======================================================
// GET ONE
//
// GET /api/staff/placement-billings/:billingId
// ======================================================

exports.getStaffPlacementBillingById = async (req, res) => {
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

    await normalizeLegacyPaymentFields(billing);

    return res.status(200).json({
      success: true,

      data: serializeBilling(billing),
    });
  } catch (error) {
    console.error("GET STAFF PLACEMENT BILLING ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load placement billing.",
    });
  }
};

// ======================================================
// UPDATE DRAFT
//
// PATCH /api/staff/placement-billings/:billingId
// ======================================================

exports.updateStaffPlacementBilling = async (req, res) => {
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

        message: "Only draft billings can be edited.",
      });
    }

    const previousValues = {
      placementFee: billing.placementFee,

      taxRate: billing.taxRate,

      dueDate: billing.dueDate,

      notes: billing.notes,
    };

    const { placementFee, taxRate, dueDate, notes } = req.body;

    // ==================================================
    // PLACEMENT FEE
    // ==================================================

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

    // ==================================================
    // TAX RATE
    // ==================================================

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

    // ==================================================
    // DUE DATE
    // ==================================================

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

    // ==================================================
    // NOTES
    // ==================================================

    const normalizedNotes = typeof notes === "string" ? notes.trim() : "";

    if (normalizedNotes.length > 2000) {
      return res.status(400).json({
        success: false,

        message: "Notes cannot exceed 2000 characters.",
      });
    }

    billing.notes = normalizedNotes || null;

    // ==================================================
    // AUDIT
    // ==================================================

    billing.auditHistory.push({
      action: "UPDATED",

      actor_type: "staff",

      actor_id: req.staff.staffId,

      details: {
        previous: previousValues,

        updated: {
          placementFee: billing.placementFee,

          taxRate: billing.taxRate,

          dueDate: billing.dueDate,

          notes: billing.notes,
        },
      },
    });

    await billing.save();

    return res.status(200).json({
      success: true,

      message: "Placement billing updated.",

      data: serializeBilling(billing),
    });
  } catch (error) {
    console.error("UPDATE STAFF PLACEMENT BILLING ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to update placement billing.",
    });
  }
};

// ======================================================
// ISSUE
//
// DRAFT -> ISSUED
//
// PATCH /api/staff/placement-billings/:billingId/issue
// ======================================================

exports.issueStaffPlacementBilling = async (req, res) => {
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

      actor_type: "staff",

      actor_id: req.staff.staffId,

      details: {
        totalAmount: billing.totalAmount,

        dueDate: billing.dueDate,
      },
    });

    await billing.save();

    return res.status(200).json({
      success: true,

      message: "Placement billing issued.",

      data: serializeBilling(billing),
    });
  } catch (error) {
    console.error("ISSUE STAFF PLACEMENT BILLING ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to issue placement billing.",
    });
  }
};

// ======================================================
// MARK PAID
//
// ISSUED -> PAID
//
// PATCH /api/staff/placement-billings/:billingId/paid
// ======================================================

exports.markStaffPlacementBillingPaid = async (req, res) => {
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

    billing.status = "paid";

    billing.paidAt = new Date();

    billing.paidAmount = totalAmount;

    billing.refundedAmount = 0;

    billing.netPaidAmount = totalAmount;

    billing.fullyRefundedAt = null;

    billing.auditHistory.push({
      action: "MARKED_PAID",

      actor_type: "staff",

      actor_id: req.staff.staffId,

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
    console.error("MARK STAFF PLACEMENT BILLING PAID ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to mark placement billing as paid.",
    });
  }
};
