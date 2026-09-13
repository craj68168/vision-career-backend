const express = require("express");

const {
  getProfile,
  updateProfile,
  uploadResume,
} = require("../../controllers/seekers/profileController");

const seekerAuth = require("../../middleware/seekerAuth");
const upload = require("../../middleware/upload");


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

// Upload resume
router.post("/resume", seekerAuth, upload.single("resume"), uploadResume);

module.exports = router;
