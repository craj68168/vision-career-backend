const express = require("express");

const {
  generateResume,
  getGeneratedResume,
} = require(
  "../../controllers/seekers/resumeController",
);

const seekerAuth = require(
  "../../middleware/seekerAuth",
);

const router = express.Router();

// Generate / regenerate privacy-safe resume
router.post(
  "/generate",
  seekerAuth,
  generateResume,
);

// View / download own generated resume
router.get(
  "/generated",
  seekerAuth,
  getGeneratedResume,
);

module.exports = router;