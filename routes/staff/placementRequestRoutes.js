const express = require("express");

const staffAuth = require("../../middleware/staffAuth");

const requireStaffPermission = require("../../middleware/requireStaffPermission");

const {
  getStaffPlacementRequests,
  getStaffPlacementRequestById,
  screenStaffPlacementRequest,
  approveStaffPlacementRequest,
  rejectStaffPlacementRequest,
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
// ======================================================

router.patch(
  "/:recruitId/screen",
  staffAuth,
  requireStaffPermission("placement_requests:review"),
  screenStaffPlacementRequest,
);

// ======================================================
// APPROVE
//
// placement_requests:approval
// ======================================================

router.patch(
  "/:recruitId/approve",
  staffAuth,
  requireStaffPermission("placement_requests:approval"),
  approveStaffPlacementRequest,
);

// ======================================================
// REJECT
//
// placement_requests:approval
// ======================================================

router.patch(
  "/:recruitId/reject",
  staffAuth,
  requireStaffPermission("placement_requests:approval"),
  rejectStaffPlacementRequest,
);

// ======================================================
// DETAILS
//
// placement_requests:view
//
// Keep generic route last.
// ======================================================

router.get(
  "/:recruitId",
  staffAuth,
  requireStaffPermission("placement_requests:view"),
  getStaffPlacementRequestById,
);

module.exports = router;
