const express = require("express");

const staffAuth = require("../../middleware/staffAuth");

const requireStaffPermission = require("../../middleware/requireStaffPermission");

const {
  getStaffSeekers,
  getStaffSeekerById,
  screenStaffSeeker,
  getStaffSeekerResume,
} = require("../../controllers/staff/seekerController");

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
// ======================================================

router.patch(
  "/:seekerId/screen",
  staffAuth,
  requireStaffPermission("seekers:manage"),
  screenStaffSeeker,
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
