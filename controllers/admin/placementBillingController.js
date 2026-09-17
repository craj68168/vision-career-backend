const PlacementBilling = require("../../models/placements/placementBillingSchema");

const {
  ensureAllPlacedBillings,
} = require("../../utils/ensurePlacementBilling");

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

  placementFee: billing.placementFee,

  taxRate: billing.taxRate,

  taxAmount: billing.taxAmount,

  totalAmount: billing.totalAmount,

  dueDate: billing.dueDate,

  status: billing.status,

  issuedAt: billing.issuedAt,

  paidAt: billing.paidAt,

  cancelledAt: billing.cancelledAt,

  refundedAt: billing.refundedAt,

  cancellationReason: billing.cancellationReason,

  notes: billing.notes,

  auditHistory: billing.auditHistory,

  createdAt: billing.createdAt,

  updatedAt: billing.updatedAt,
});

// ======================================================
// GET ALL
//
// GET /api/admin/placement-billings
// ======================================================

exports.getPlacementBillings = async (req, res) => {
  try {
    // Backfill old PLACED records.
    await ensureAllPlacedBillings();

    const billings = await PlacementBilling.find().sort({
      createdAt: -1,
    });

    const data = billings.map(serializeBilling);

    const billedTotal = data
      .filter((item) => ["issued", "paid"].includes(item.status))
      .reduce((sum, item) => sum + item.totalAmount, 0);

    const paidTotal = data
      .filter((item) => item.status === "paid")
      .reduce((sum, item) => sum + item.totalAmount, 0);

    const outstandingTotal = data
      .filter((item) => item.status === "issued")
      .reduce((sum, item) => sum + item.totalAmount, 0);

    return res.status(200).json({
      success: true,

      count: data.length,

      summary: {
        total: data.length,

        draft: data.filter((item) => item.status === "draft").length,

        issued: data.filter((item) => item.status === "issued").length,

        paid: data.filter((item) => item.status === "paid").length,

        cancelled: data.filter((item) => item.status === "cancelled").length,

        billedTotal,

        paidTotal,

        outstandingTotal,
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
// GET ONE
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

    return res.status(200).json({
      success: true,

      data: serializeBilling(billing),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,

      message: "Failed to load placement billing.",
    });
  }
};

// ======================================================
// UPDATE DRAFT BILLING
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

    if (billing.status !== "draft") {
      return res.status(409).json({
        success: false,

        message: "Only draft billings can be edited.",
      });
    }

    const { placementFee, taxRate, dueDate, notes } = req.body;

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

    billing.dueDate = dueDate ? new Date(dueDate) : null;

    billing.notes = notes ? String(notes).trim() : null;

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
    console.error("UPDATE BILLING ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to update placement billing.",
    });
  }
};

// ======================================================
// ISSUE BILLING
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

    if (billing.totalAmount <= 0) {
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
    });

    await billing.save();

    return res.status(200).json({
      success: true,

      message: "Placement billing issued.",

      data: serializeBilling(billing),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,

      message: "Failed to issue placement billing.",
    });
  }
};

// ======================================================
// MARK PAID
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

    billing.status = "paid";

    billing.paidAt = new Date();

    billing.auditHistory.push({
      action: "MARKED_PAID",

      actor_type: "admin",

      actor_id: req.admin.adminId,
    });

    await billing.save();

    return res.status(200).json({
      success: true,

      message: "Placement billing marked as paid.",

      data: serializeBilling(billing),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,

      message: "Failed to mark placement billing as paid.",
    });
  }
};

// ======================================================
// CANCEL
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
    });

    await billing.save();

    return res.status(200).json({
      success: true,

      message: "Placement billing cancelled.",

      data: serializeBilling(billing),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,

      message: "Failed to cancel placement billing.",
    });
  }
};
