const express = require("express");

const {
  login,

  getCurrentStaff,

  changePassword,
} = require("../../controllers/staff/authController");

const staffAuth = require("../../middleware/staffAuth");

const router = express.Router();

// ======================================================
// LOGIN
//
// POST /api/staff/auth/login
// ======================================================

router.post("/login", login);

// ======================================================
// CURRENT STAFF
//
// GET /api/staff/auth/me
// ======================================================

router.get("/me", staffAuth, getCurrentStaff);

// ======================================================
// CHANGE PASSWORD
//
// PATCH /api/staff/auth/password
// ======================================================

router.patch("/password", staffAuth, changePassword);

module.exports = router;
