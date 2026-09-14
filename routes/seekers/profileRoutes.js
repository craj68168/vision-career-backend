const express = require("express");

const {
  getProfile,
  updateProfile,
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
// UPDATE COMPLETE SEEKER PROFILE
// PATCH /api/seekers/profile
//
// Supports:
// - Normal profile fields
// - Profile photo
// - Resume
// ======================================================

router.patch(
  "/",
  seekerAuth,
  upload.fields([
    {
      name: "profile_photo",
      maxCount: 1,
    },
    {
      name: "resume",
      maxCount: 1,
    },
    {
      name: "other_documents",
      maxCount: 10,
    },
  ]),
  updateProfile,
);
module.exports = router;