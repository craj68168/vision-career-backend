const express = require("express");

const {
  login,
  getCurrentStaff,
} = require("../../controllers/staff/authController");

const staffAuth = require("../../middleware/staffAuth");

const router = express.Router();

// ======================================================
// LOGIN
// ======================================================

router.post("/login", login);

// ======================================================
// CURRENT STAFF
// ======================================================

router.get("/me", staffAuth, getCurrentStaff);

module.exports = router;
