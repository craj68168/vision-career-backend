const express = require("express");

const providerAuth = require("../../middleware/providerAuth");

const {
  getPlacementCandidates,
  getPlacementCandidateById,
  getPlacementCandidatePhoto,
  updatePlacementCandidateStatus,
} = require("../../controllers/providers/placementCandidateController");

const router = express.Router();

// ======================================================
// GET MATCHED CANDIDATES
//
// GET
// /api/providers/placement-candidates
//
// Optional:
//
// ?recruitId=R-XXXXXX
// ======================================================

router.get("/", providerAuth, getPlacementCandidates);

// ======================================================
// GET PROTECTED CANDIDATE PHOTO
//
// GET
// /api/providers/placement-candidates/:placementCandidateId/photo
//
// IMPORTANT:
//
// Keep this route BEFORE:
//
// /:placementCandidateId
//
// Provider only receives image bytes.
//
// Never expose:
//
// - seekerId
// - profile_photo
// - storage key
// - private storage path
// ======================================================

router.get(
  "/:placementCandidateId/photo",

  providerAuth,

  getPlacementCandidatePhoto,
);

// ======================================================
// UPDATE STATUS
//
// PATCH
// /api/providers/placement-candidates/:placementCandidateId/status
//
// Keep before:
//
// /:placementCandidateId
// ======================================================

router.patch(
  "/:placementCandidateId/status",

  providerAuth,

  updatePlacementCandidateStatus,
);

// ======================================================
// GET ONE
//
// GET
// /api/providers/placement-candidates/:placementCandidateId
//
// Keep last.
// ======================================================

router.get(
  "/:placementCandidateId",

  providerAuth,

  getPlacementCandidateById,
);

module.exports = router;
