const express = require("express");

const {
  getProfile,
  updateProfile,
} = require("../../controllers/seekers/profileController");

const seekerAuth = require("../../middleware/seekerAuth");

const router = express.Router();

// ======================================================
// GET LOGGED-IN SEEKER PROFILE
// GET /api/seekers/profile
// ======================================================

router.get("/", seekerAuth, getProfile);

// ======================================================
// UPDATE LOGGED-IN SEEKER PROFILE
// PATCH /api/seekers/profile
// ======================================================

router.patch("/", seekerAuth, updateProfile);

module.exports = router;