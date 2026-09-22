const express = require("express");

const staffAuth = require("../../middleware/staffAuth");

const requireStaffPermission = require("../../middleware/requireStaffPermission");

const {
  getStaffProviders,
  getStaffProviderById,
  reviewStaffProvider,
} = require("../../controllers/staff/providerController");

const router = express.Router();

// ======================================================
// LIST
// ======================================================

router.get(
  "/",
  staffAuth,
  requireStaffPermission("providers:view"),
  getStaffProviders,
);

// ======================================================
// REVIEW
//
// Keep before /:registerId
// ======================================================

router.patch(
  "/:registerId/review",
  staffAuth,
  requireStaffPermission("providers:manage"),
  reviewStaffProvider,
);

// ======================================================
// DETAILS
// ======================================================

router.get(
  "/:registerId",
  staffAuth,
  requireStaffPermission("providers:view"),
  getStaffProviderById,
);

module.exports = router;
