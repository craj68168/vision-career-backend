const express = require("express");

const adminAuth = require("../../middleware/adminAuth");

const {
  getPlacementRequests,
  getPlacementRequestById,
  approvePlacementRequest,
  rejectPlacementRequest,
} = require("../../controllers/admin/placementRequestController");

const router = express.Router();

router.get("/", adminAuth, getPlacementRequests);

router.get("/:recruitId", adminAuth, getPlacementRequestById);

router.patch("/:recruitId/approve", adminAuth, approvePlacementRequest);

router.patch("/:recruitId/reject", adminAuth, rejectPlacementRequest);

module.exports = router;
