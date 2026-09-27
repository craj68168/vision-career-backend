const express = require("express");

const providerAuth = require("../../middleware/providerAuth");

const {
  getProviderInterviews,
  getProviderInterviewById,
  scheduleProviderInterview,
  updateProviderInterview,
} = require("../../controllers/providers/interviewController");

const router = express.Router();

// ======================================================
// GET ALL
// ======================================================

router.get("/", providerAuth, getProviderInterviews);

// ======================================================
// SCHEDULE
//
// APPLICATION:
// applicationId
//
// PLACEMENT:
// placementCandidateId
// ======================================================

router.post("/", providerAuth, scheduleProviderInterview);

// ======================================================
// GET ONE
// ======================================================

router.get("/:interviewId", providerAuth, getProviderInterviewById);

// ======================================================
// UPDATE
// ======================================================

router.patch("/:interviewId", providerAuth, updateProviderInterview);

module.exports = router;
