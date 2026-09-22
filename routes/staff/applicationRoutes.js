const express = require("express");

const staffAuth = require("../../middleware/staffAuth");

const requireStaffPermission = require("../../middleware/requireStaffPermission");

const {
  getApplications,
  getApplicationById,
  screenApplication,
} = require("../../controllers/staff/applicationController");

const router = express.Router();

// ======================================================
// APPLICATION LIST
//
// Permission:
// applications:view
// ======================================================

router.get(
  "/",
  staffAuth,
  requireStaffPermission("applications:view"),
  getApplications,
);

// ======================================================
// APPLICATION DETAILS
//
// Permission:
// applications:view
// ======================================================

router.get(
  "/:applicationId",
  staffAuth,
  requireStaffPermission("applications:view"),
  getApplicationById,
);

// ======================================================
// SCREEN APPLICATION
//
// Permission:
// applications:review
// ======================================================

router.patch(
  "/:applicationId/screen",
  staffAuth,
  requireStaffPermission("applications:review"),
  screenApplication,
);

module.exports = router;
