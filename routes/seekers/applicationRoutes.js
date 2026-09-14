const express = require("express");

const {
  applyForVacancy,
  getMyApplications,
  getMyApplicationById,
} = require(
  "../../controllers/seekers/applicationController",
);

const seekerAuth = require(
  "../../middleware/seekerAuth",
);

const router = express.Router();

// ======================================================
// GET MY APPLICATIONS
// GET /api/seekers/applications
// ======================================================

router.get(
  "/",
  seekerAuth,
  getMyApplications,
);

// ======================================================
// GET MY APPLICATION DETAILS
// GET /api/seekers/applications/:application_id
// ======================================================

router.get(
  "/:application_id",
  seekerAuth,
  getMyApplicationById,
);

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