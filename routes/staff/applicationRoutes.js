const express = require("express");

const staffAuth = require("../../middleware/staffAuth");

const requireStaffPermission = require("../../middleware/requireStaffPermission");

const {
  getApplications,
  getApplicationById,
  getStaffApplicationResume,
  screenApplication,
  approveStaffApplication,
  rejectStaffApplication,
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
// SCREEN APPLICATION
//
// Permission:
// applications:review
//
// Staff screening:
// SCREENED / NEEDS_ATTENTION
//
// Screening is independent from approval.
// ======================================================

router.patch(
  "/:applicationId/screen",

  staffAuth,

  requireStaffPermission("applications:review"),

  screenApplication,
);

// ======================================================
// APPROVE APPLICATION
//
// Permission:
// applications:approval
//
// PENDING_ADMIN_APPROVAL
// ->
// SENT_TO_PROVIDER
// ======================================================

router.patch(
  "/:applicationId/approve",

  staffAuth,

  requireStaffPermission("applications:approval"),

  approveStaffApplication,
);

// ======================================================
// REJECT APPLICATION
//
// Permission:
// applications:approval
//
// PENDING_ADMIN_APPROVAL
// ->
// ADMIN_REJECTED
// ======================================================

router.patch(
  "/:applicationId/reject",

  staffAuth,

  requireStaffPermission("applications:approval"),

  rejectStaffApplication,
);

// ======================================================
// APPLICATION DETAILS
//
// Permission:
// applications:view
//
// Keep after action routes.
// ======================================================

router.get(
  "/:applicationId",

  staffAuth,

  requireStaffPermission("applications:view"),

  getApplicationById,
);

module.exports = router;
