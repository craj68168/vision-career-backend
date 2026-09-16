const express = require("express");

const {
  getDashboardSummary,
} = require(
  "../../controllers/seekers/dashboardController",
);

const seekerAuth = require(
  "../../middleware/seekerAuth",
);

const router = express.Router();

router.get(
  "/summary",
  seekerAuth,
  getDashboardSummary,
);

module.exports = router;