const express = require("express");

const staffAuth = require("../../middleware/staffAuth");

const requireStaffPermission = require("../../middleware/requireStaffPermission");

const {
  getApplications,

  getApplicationById,

  getStaffApplicationResume,

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
// APPLICATION FROZEN RESUME
//
// Permission:
// applications:view
//
// Keep before /:applicationId.
// ======================================================

router.get(
  "/:applicationId/resume",

  staffAuth,

  requireStaffPermission("applications:view"),

  getStaffApplicationResume,
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
