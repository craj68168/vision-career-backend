const express = require("express");

const staffAuth = require("../../middleware/staffAuth");

const requireStaffPermission = require("../../middleware/requireStaffPermission");

const {
  getStaffPlacementCandidates,
  getStaffPlacementCandidateById,
  reviewStaffPlacementCandidate,
} = require("../../controllers/staff/placementCandidateController");

const router = express.Router();

// ======================================================
// LIST
// ======================================================

router.get(
  "/",
  staffAuth,
  requireStaffPermission("placement_requests:manage_candidates"),
  getStaffPlacementCandidates,
);

// ======================================================
// STAFF REVIEW
//
// Keep before generic details route.
// ======================================================

router.patch(
  "/:placementCandidateId/review",
  staffAuth,
  requireStaffPermission("placement_requests:manage_candidates"),
  reviewStaffPlacementCandidate,
);

// ======================================================
// DETAILS
// ======================================================

router.get(
  "/:placementCandidateId",
  staffAuth,
  requireStaffPermission("placement_requests:manage_candidates"),
  getStaffPlacementCandidateById,
);

module.exports = router;
