const express = require("express");

const adminAuth = require("../../middleware/adminAuth");

const {
  getPlacementBillings,
  getPlacementBillingById,
  updatePlacementBilling,
  issuePlacementBilling,
  markPlacementBillingPaid,
  cancelPlacementBilling,
  refundPlacementBilling,
} = require("../../controllers/admin/placementBillingController");

const router = express.Router();

router.get("/", adminAuth, getPlacementBillings);

router.get("/:billingId", adminAuth, getPlacementBillingById);

router.patch("/:billingId", adminAuth, updatePlacementBilling);

router.patch("/:billingId/issue", adminAuth, issuePlacementBilling);

router.patch("/:billingId/paid", adminAuth, markPlacementBillingPaid);

router.patch("/:billingId/cancel", adminAuth, cancelPlacementBilling);

router.patch("/:billingId/refund", adminAuth, refundPlacementBilling);

module.exports = router;
