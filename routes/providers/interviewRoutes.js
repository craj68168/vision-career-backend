const express = require("express");

const authMiddleware = require("../../middleware/authMiddleware");

const {
  getProviderInterviews,

  getProviderInterviewById,

  scheduleProviderInterview,

  updateProviderInterview,
} = require("../../controllers/providers/interviewController");

const router = express.Router();

// ======================================================
// GET ALL PROVIDER INTERVIEWS
//
// GET
// /api/providers/interviews
//
// Optional:
//
// ?status=CONFIRMED
//
// ======================================================

router.get("/", authMiddleware, getProviderInterviews);

// ======================================================
// SCHEDULE INTERVIEW
//
// POST
// /api/providers/interviews
//
// ======================================================

router.post("/", authMiddleware, scheduleProviderInterview);

// ======================================================
// GET ONE INTERVIEW
//
// GET
// /api/providers/interviews/:interviewId
//
// ======================================================

router.get("/:interviewId", authMiddleware, getProviderInterviewById);

// ======================================================
// UPDATE / RESCHEDULE INTERVIEW
//
// PATCH
// /api/providers/interviews/:interviewId
//
// ======================================================

router.patch("/:interviewId", authMiddleware, updateProviderInterview);

module.exports = router;
