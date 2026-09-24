const express = require("express");

const adminAuth = require("../../middleware/adminAuth");

const {
  getAdminInterviews,

  getAdminInterviewById,

  updateAdminInterview,
} = require("../../controllers/admin/interviewController");

const router = express.Router();

// ======================================================
// GET ALL INTERVIEWS
//
// GET
// /api/admin/interviews
//
// Optional:
//
// ?status=CONFIRMED
// ?method=ZOOM
// ?search=keyword
//
// ======================================================

router.get("/", adminAuth, getAdminInterviews);

// ======================================================
// GET ONE INTERVIEW
//
// GET
// /api/admin/interviews/:interviewId
//
// ======================================================

router.get("/:interviewId", adminAuth, getAdminInterviewById);

// ======================================================
// UPDATE / COORDINATE INTERVIEW
//
// PATCH
// /api/admin/interviews/:interviewId
//
// Admin can:
//
// - change interview date
// - change time
// - change timezone
// - change method
// - add/update Zoom/Meet link
// - update notes
//
// ======================================================

router.patch("/:interviewId", adminAuth, updateAdminInterview);

module.exports = router;
