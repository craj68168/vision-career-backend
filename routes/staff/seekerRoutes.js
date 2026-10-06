const express = require("express");

const staffAuth = require("../../middleware/staffAuth");

const requireStaffPermission = require("../../middleware/requireStaffPermission");

const {
  getStaffSeekers,

  getStaffSeekerById,

  screenStaffSeeker,

  getStaffSeekerResume,
} = require("../../controllers/staff/seekerController");

const {
  updateStaffSeekerApproval,
} = require("../../controllers/staff/seekerApprovalController");

const router = express.Router();

// ======================================================
// LIST
// ======================================================

router.get(
  "/",

  staffAuth,

  requireStaffPermission("seekers:view"),

  getStaffSeekers,
);

// ======================================================
// RESUME
//
// Keep before /:seekerId
// ======================================================

router.get(
  "/:seekerId/resume",

  staffAuth,

  requireStaffPermission("seekers:view"),

  getStaffSeekerResume,
);

// ======================================================
// SCREEN
//
// seekers:manage
//
// Screening:
// SCREENED / NEEDS_ATTENTION
//
// Screening is separate from final approval.
// ======================================================

router.patch(
  "/:seekerId/screen",

  staffAuth,

  requireStaffPermission("seekers:manage"),

  screenStaffSeeker,
);

// ======================================================
// APPROVE / REJECT
//
// seekers:approval
//
// Approval sends the seeker an email.
// ======================================================

router.patch(
  "/:seekerId/approval",

  staffAuth,

  requireStaffPermission("seekers:approval"),

  updateStaffSeekerApproval,
);

// ======================================================
// DETAILS
// ======================================================

router.get(
  "/:seekerId",

  staffAuth,

  requireStaffPermission("seekers:view"),

  getStaffSeekerById,
);

module.exports = router;
