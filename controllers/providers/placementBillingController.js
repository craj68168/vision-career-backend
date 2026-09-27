const PlacementBilling = require("../../models/placements/placementBillingSchema");

// ======================================================
// MONEY
// ======================================================

const roundMoney = (value) => {
  return Math.round(Number(value || 0) * 100) / 100;
};

// ======================================================
// PROVIDER VISIBILITY
//
// Draft:
// Admin only.
//
// Issued:
// Provider can see.
//
// Paid / Refund states:
// Provider can see.
//
// Cancelled:
// Provider can see only if it had already been issued.
// ======================================================

const getProviderVisibilityFilter = () => ({
  $or: [
    {
      status: {
        $in: ["issued", "paid", "partially_refunded", "refunded"],
      },
    },

    {
      status: "cancelled",

      issuedAt: {
        $ne: null,
      },
    },
  ],
});

// ======================================================
// REFUND SERIALIZER
// ======================================================

const serializeRefund = (refund) => ({
  refundId: refund.refundId,

  amount: Number(refund.amount || 0),

  reason: refund.reason,

  refundedAt: refund.refunded_at,
});

// ======================================================
// SAFE PROVIDER SERIALIZER
//
// DO NOT EXPOSE:
//
// seekerId
// providerId
// auditHistory
// Admin IDs
// Staff IDs
// ======================================================

const serializeProviderBilling = (billing) => {
  const totalAmount = Number(billing.totalAmount || 0);

  const paidAmount = Number(billing.paidAmount || 0);

  const amountDue =
    billing.status === "issued"
      ? Math.max(roundMoney(totalAmount - paidAmount), 0)
      : 0;

  return {
    billingId: billing.billingId,

    placementCandidateId: billing.placementCandidateId,

    recruitId: billing.recruitId,

    companyName: billing.companyName,

    candidateName: billing.candidateName,

    jobTitle: billing.jobTitle,

    placementDate: billing.placementDate,

    currency: billing.currency,

    placementFee: Number(billing.placementFee || 0),

    taxRate: Number(billing.taxRate || 0),

    taxAmount: Number(billing.taxAmount || 0),

    totalAmount,

    dueDate: billing.dueDate,

    paidAmount,

    refundedAmount: Number(billing.refundedAmount || 0),

    netPaidAmount: Number(billing.netPaidAmount || 0),

    amountDue,

    status: billing.status,

    issuedAt: billing.issuedAt,

    paidAt: billing.paidAt,

    cancelledAt: billing.cancelledAt,

    fullyRefundedAt: billing.fullyRefundedAt,

    cancellationReason: billing.cancellationReason,

    notes: billing.notes,

    refundHistory: Array.isArray(billing.refundHistory)
      ? billing.refundHistory.map(serializeRefund)
      : [],

    createdAt: billing.createdAt,

    updatedAt: billing.updatedAt,
  };
};

// ======================================================
// GET PROVIDER BILLINGS
//
// GET /api/providers/placement-billings
//
// Optional:
// ?status=issued
// ======================================================

exports.getProviderPlacementBillings = async (req, res) => {
  try {
    const providerId = req.registerId;

    const filter = {
      providerId,

      ...getProviderVisibilityFilter(),
    };

    const requestedStatus = String(req.query.status || "")
      .trim()
      .toLowerCase();

    const allowedStatuses = [
      "issued",
      "paid",
      "partially_refunded",
      "refunded",
      "cancelled",
    ];

    if (requestedStatus) {
      if (!allowedStatuses.includes(requestedStatus)) {
        return res.status(400).json({
          success: false,

          message: "Invalid billing status filter.",
        });
      }

      if (requestedStatus === "cancelled") {
        filter.$or = [
          {
            status: "cancelled",

            issuedAt: {
              $ne: null,
            },
          },
        ];
      } else {
        filter.$or = [
          {
            status: requestedStatus,
          },
        ];
      }
    }

    const billings = await PlacementBilling.find(filter).sort({
      createdAt: -1,
    });

    const data = billings.map(serializeProviderBilling);

    const billableStatuses = [
      "issued",
      "paid",
      "partially_refunded",
      "refunded",
    ];

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
      .reduce((sum, item) => sum + Number(item.amountDue || 0), 0);

    const now = new Date();

    const overdueBillings = data.filter((item) => {
      if (item.status !== "issued" || !item.dueDate) {
        return false;
      }

      const dueDate = new Date(item.dueDate);

      return !Number.isNaN(dueDate.getTime()) && dueDate < now;
    });

    const overdueTotal = overdueBillings.reduce(
      (sum, item) => sum + Number(item.amountDue || 0),
      0,
    );

    return res.status(200).json({
      success: true,

      count: data.length,

      summary: {
        total: data.length,

        issued: data.filter((item) => item.status === "issued").length,

        paid: data.filter((item) => item.status === "paid").length,

        partiallyRefunded: data.filter(
          (item) => item.status === "partially_refunded",
        ).length,

        refunded: data.filter((item) => item.status === "refunded").length,

        cancelled: data.filter((item) => item.status === "cancelled").length,

        overdue: overdueBillings.length,

        billedTotal: roundMoney(billedTotal),

        paidTotal: roundMoney(paidTotal),

        refundedTotal: roundMoney(refundedTotal),

        outstandingTotal: roundMoney(outstandingTotal),

        overdueTotal: roundMoney(overdueTotal),
      },

      data,
    });
  } catch (error) {
    console.error("GET PROVIDER PLACEMENT BILLINGS ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load placement billings.",
    });
  }
};

// ======================================================
// GET ONE
// ======================================================

exports.getProviderPlacementBillingById = async (req, res) => {
  try {
    const billing = await PlacementBilling.findOne({
      billingId: req.params.billingId,

      providerId: req.registerId,

      ...getProviderVisibilityFilter(),
    });

    if (!billing) {
      return res.status(404).json({
        success: false,

        message: "Placement billing not found.",
      });
    }

    return res.status(200).json({
      success: true,

      data: serializeProviderBilling(billing),
    });
  } catch (error) {
    console.error("GET PROVIDER PLACEMENT BILLING ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load placement billing.",
    });
  }
};
