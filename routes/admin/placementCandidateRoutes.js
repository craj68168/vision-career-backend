const express = require("express");

const adminAuth = require("../../middleware/adminAuth");

const {
  getEligibleSeekers,
  getMatchedCandidates,
  matchCandidate,
} = require("../../controllers/admin/placementCandidateController");

const router = express.Router();

// ======================================================
// ELIGIBLE SEEKERS
// ======================================================

router.get("/:recruitId/eligible", adminAuth, getEligibleSeekers);

// ======================================================
// MATCHED CANDIDATES
// ======================================================

router.get("/:recruitId", adminAuth, getMatchedCandidates);

// ======================================================
// MATCH SEEKER
// ======================================================

router.post("/:recruitId/:seekerId", adminAuth, matchCandidate);

module.exports = router;
