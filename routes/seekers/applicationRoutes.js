const express = require("express");

const {
  applyForVacancy,
} = require(
  "../../controllers/seekers/applicationController",
);

const seekerAuth = require(
  "../../middleware/seekerAuth",
);

const router = express.Router();

// ======================================================
// APPLY FOR VACANCY
// POST /api/seekers/applications
// ======================================================

router.post(
  "/",
  seekerAuth,
  applyForVacancy,
);

module.exports = router;