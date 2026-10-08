const express = require("express");

const authMiddleware = require("../../middleware/authMiddleware");

const {
  getProviderApplications,
  getProviderApplicationById,
  getProviderApplicationResume,
  getProviderApplicationPhoto,
  updateProviderApplicationStatus,
} = require("../../controllers/providers/applicationController");

const router = express.Router();

// ======================================================
// GET ALL APPLICATIONS
//
// GET
// /api/providers/applications
// ======================================================

router.get("/", authMiddleware, getProviderApplications);

// ======================================================
// GET CANDIDATE PHOTO
//
// GET
// /api/providers/applications/:applicationId/photo
//
// IMPORTANT:
//
// Keep before:
//
// /:applicationId
//
// Provider can access the photo only when:
//
// - authenticated
// - application belongs to Provider
// - application has already passed Admin/Staff approval
// ======================================================

router.get(
  "/:applicationId/photo",

  authMiddleware,

  getProviderApplicationPhoto,
);

// ======================================================
// GET APPLICATION RESUME
//
// GET
// /api/providers/applications/:applicationId/resume
//
// Keep before /:applicationId
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
// Keep last.
// ======================================================

router.get(
  "/:applicationId",

  authMiddleware,

  getProviderApplicationById,
);

module.exports = router;
