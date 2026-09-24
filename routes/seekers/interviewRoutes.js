const express = require("express");

const seekerAuth = require("../../middleware/seekerAuth");

const {
  getMyInterviews,

  getMyInterviewById,
} = require("../../controllers/seekers/interviewController");

const router = express.Router();

// ======================================================
// GET MY INTERVIEWS
//
// GET
// /api/seekers/interviews
//
// Optional:
//
// ?status=CONFIRMED
//
// ======================================================

router.get("/", seekerAuth, getMyInterviews);

// ======================================================
// GET MY INTERVIEW DETAILS
//
// GET
// /api/seekers/interviews/:interviewId
//
// ======================================================

router.get("/:interviewId", seekerAuth, getMyInterviewById);

module.exports = router;
