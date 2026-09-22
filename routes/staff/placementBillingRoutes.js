const express = require("express");

const staffAuth = require("../../middleware/staffAuth");

const requireStaffPermission = require("../../middleware/requireStaffPermission");

const {
  getStaffPlacementBillings,

  getStaffPlacementBillingById,

  updateStaffPlacementBilling,

  issueStaffPlacementBilling,

  markStaffPlacementBillingPaid,
} = require("../../controllers/staff/placementBillingController");

const router = express.Router();

// ======================================================
// LIST
// ======================================================

router.get(
  "/",

  staffAuth,

  requireStaffPermission("billing:view"),

  getStaffPlacementBillings,
);

// ======================================================
// UPDATE DRAFT
// ======================================================

router.patch(
  "/:billingId",

  staffAuth,

  requireStaffPermission("billing:manage"),

  updateStaffPlacementBilling,
);

// ======================================================
// ISSUE
// ======================================================

router.patch(
  "/:billingId/issue",

  staffAuth,

  requireStaffPermission("billing:manage"),

  issueStaffPlacementBilling,
);

// ======================================================
// MARK PAID
// ======================================================

router.patch(
  "/:billingId/paid",

  staffAuth,

  requireStaffPermission("billing:manage"),

  markStaffPlacementBillingPaid,
);

// ======================================================
// DETAILS
// ======================================================

router.get(
  "/:billingId",

  staffAuth,

  requireStaffPermission("billing:view"),

  getStaffPlacementBillingById,
);

module.exports = router;
