const express = require("express");

const providerAuth = require("../../middleware/providerAuth");

const {
  getPlacementCandidates,
  getPlacementCandidateById,
  updatePlacementCandidateStatus,
} = require("../../controllers/providers/placementCandidateController");

const router = express.Router();

// ======================================================
// GET MATCHED CANDIDATES
//
// Optional:
// ?recruitId=R-XXXXXX
// ======================================================

router.get("/", providerAuth, getPlacementCandidates);

// ======================================================
// GET ONE
// ======================================================

router.get("/:placementCandidateId", providerAuth, getPlacementCandidateById);

// ======================================================
// UPDATE STATUS
// ======================================================

router.patch(
  "/:placementCandidateId/status",
  providerAuth,
  updatePlacementCandidateStatus,
);

module.exports = router;
