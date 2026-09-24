const express = require("express");

const staffAuth = require("../../middleware/staffAuth");

const requireStaffPermission = require("../../middleware/requireStaffPermission");

const {
  getStaffInterviews,

  getStaffInterviewById,

  updateStaffInterview,
} = require("../../controllers/staff/interviewController");

const router = express.Router();

// ======================================================
// GET ALL INTERVIEWS
//
// GET
// /api/staff/interviews
//
// Permission:
// interviews:view
//
// ======================================================

router.get(
  "/",
  staffAuth,
  requireStaffPermission("interviews:view"),
  getStaffInterviews,
);

// ======================================================
// GET ONE INTERVIEW
//
// GET
// /api/staff/interviews/:interviewId
//
// Permission:
// interviews:view
//
// ======================================================

router.get(
  "/:interviewId",
  staffAuth,
  requireStaffPermission("interviews:view"),
  getStaffInterviewById,
);

// ======================================================
// UPDATE / COORDINATE INTERVIEW
//
// PATCH
// /api/staff/interviews/:interviewId
//
// Permission:
// interviews:manage
//
// ======================================================

router.patch(
  "/:interviewId",
  staffAuth,
  requireStaffPermission("interviews:manage"),
  updateStaffInterview,
);

module.exports = router;
