const express = require("express");

const authMiddleware = require("../../middleware/authMiddleware");

const {
  getProviderApplications,
  getProviderApplicationById,
  getProviderApplicationResume,
  updateProviderApplicationStatus,
} = require("../../controllers/providers/applicationController");

const router = express.Router();

// ======================================================
// GET ALL APPLICATIONS
//
// GET /api/providers/applications
//
// ======================================================

router.get("/", authMiddleware, getProviderApplications);

// ======================================================
// GET APPLICATION RESUME
//
// GET
// /api/providers/applications/:applicationId/resume
//
// Keep this before /:applicationId
//
// ======================================================

router.get(
  "/:applicationId/resume",
  authMiddleware,
  getProviderApplicationResume,
);

// ======================================================
// UPDATE APPLICATION STATUS
//
// PATCH
// /api/providers/applications/:applicationId/status
//
// ======================================================

router.patch(
  "/:applicationId/status",
  authMiddleware,
  updateProviderApplicationStatus,
);

// ======================================================
// GET ONE APPLICATION
//
// GET
// /api/providers/applications/:applicationId
//
// ======================================================

router.get("/:applicationId", authMiddleware, getProviderApplicationById);

module.exports = router;
