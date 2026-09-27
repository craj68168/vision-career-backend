const express = require("express");

const providerAuth = require("../../middleware/providerAuth");

const {
  getProviderPlacementBillings,
  getProviderPlacementBillingById,
} = require("../../controllers/providers/placementBillingController");

const router = express.Router();

// ======================================================
// LIST
// ======================================================

router.get("/", providerAuth, getProviderPlacementBillings);

// ======================================================
// DETAILS
// ======================================================

router.get("/:billingId", providerAuth, getProviderPlacementBillingById);

module.exports = router;
