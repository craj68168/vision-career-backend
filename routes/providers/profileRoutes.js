const express = require("express");

const {
  getProfile,
  updateProfile,
} = require("../../controllers/providers/profileController");

const providerAuth = require("../../middleware/providerAuth");

const router = express.Router();

// ======================================================
// GET PROVIDER PROFILE
// GET /api/providers/profile
// ======================================================

router.get("/", providerAuth, getProfile);

// ======================================================
// UPDATE PROVIDER PROFILE
// PATCH /api/providers/profile
// ======================================================

router.patch("/", providerAuth, updateProfile);

module.exports = router;
