const express = require("express");

const adminAuth = require("../../middleware/adminAuth");

const {
  getAdminApplications,
  getAdminApplicationById,
  getAdminApplicationResume,
  approveAdminApplication,
  rejectAdminApplication,
} = require("../../controllers/admin/applicationController");

const router = express.Router();

// ======================================================
// GET ALL
// ======================================================

router.get("/", adminAuth, getAdminApplications);

// ======================================================
// RESUME
//
// Keep this before /:applicationId
// ======================================================

router.get("/:applicationId/resume", adminAuth, getAdminApplicationResume);

// ======================================================
// APPROVE
// ======================================================

router.patch("/:applicationId/approve", adminAuth, approveAdminApplication);

// ======================================================
// REJECT
// ======================================================

router.patch("/:applicationId/reject", adminAuth, rejectAdminApplication);

// ======================================================
// DETAILS
// ======================================================

router.get("/:applicationId", adminAuth, getAdminApplicationById);

module.exports = router;
