const express = require("express");

const adminAuth = require("../../middleware/adminAuth");

const {
  getSeekers,
  getSeekerById,
  createSeeker,
  updateSeeker,
  updateApprovalStatus,
  updateAccountStatus,
  updatePlacementStatus,
  getSeekerResume,
  deleteSeeker,
} = require("../../controllers/admin/seekerController");

const router = express.Router();

// ======================================================
// LIST SEEKERS
// GET /api/admin/seekers
// ======================================================

router.get("/", adminAuth, getSeekers);

// ======================================================
// CREATE SEEKER
// POST /api/admin/seekers
// ======================================================

router.post("/", adminAuth, createSeeker);

// ======================================================
// RESUME
// GET /api/admin/seekers/:seekerId/resume
// ======================================================

router.get("/:seekerId/resume", adminAuth, getSeekerResume);

// ======================================================
// ONE SEEKER
// GET /api/admin/seekers/:seekerId
// ======================================================

router.get("/:seekerId", adminAuth, getSeekerById);

// ======================================================
// EDIT SEEKER
// PATCH /api/admin/seekers/:seekerId
// ======================================================

router.patch("/:seekerId", adminAuth, updateSeeker);

// ======================================================
// APPROVE / REJECT
// PATCH /api/admin/seekers/:seekerId/approval
// ======================================================

router.patch("/:seekerId/approval", adminAuth, updateApprovalStatus);

// ======================================================
// ACCOUNT STATUS
// PATCH /api/admin/seekers/:seekerId/account-status
// ======================================================

router.patch("/:seekerId/account-status", adminAuth, updateAccountStatus);

// ======================================================
// PLACEMENT STATUS
// PATCH /api/admin/seekers/:seekerId/placement-status
// ======================================================

router.patch("/:seekerId/placement-status", adminAuth, updatePlacementStatus);

// ======================================================
// DELETE
// DELETE /api/admin/seekers/:seekerId
// ======================================================

router.delete("/:seekerId", adminAuth, deleteSeeker);

module.exports = router;
