const express = require("express");

const staffAuth = require("../../middleware/staffAuth");

const requireStaffPermission = require("../../middleware/requireStaffPermission");

const {
  getStaffPlacementRequests,
  getStaffPlacementRequestById,
  screenStaffPlacementRequest,
} = require("../../controllers/staff/placementRequestController");

const router = express.Router();

// ======================================================
// LIST
//
// placement_requests:view
// ======================================================

router.get(
  "/",
  staffAuth,
  requireStaffPermission("placement_requests:view"),
  getStaffPlacementRequests,
);

// ======================================================
// SCREEN
//
// placement_requests:review
//
// Keep before /:recruitId
// ======================================================

router.patch(
  "/:recruitId/screen",
  staffAuth,
  requireStaffPermission("placement_requests:review"),
  screenStaffPlacementRequest,
);

// ======================================================
// DETAILS
//
// placement_requests:view
// ======================================================

router.get(
  "/:recruitId",
  staffAuth,
  requireStaffPermission("placement_requests:view"),
  getStaffPlacementRequestById,
);

module.exports = router;
