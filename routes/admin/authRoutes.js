const express = require("express");

const {
  login,
  me,
  updateCredentials,
} = require("../../controllers/admin/authController");

const adminAuth = require("../../middleware/adminAuth");

const router = express.Router();

// ======================================================
// ADMIN LOGIN
//
// POST /api/admin/auth/login
// ======================================================

router.post("/login", login);

// ======================================================
// CURRENT ADMIN
//
// GET /api/admin/auth/me
// ======================================================

router.get("/me", adminAuth, me);

// ======================================================
// UPDATE CREDENTIALS
//
// PATCH /api/admin/auth/credentials
// ======================================================

router.patch("/credentials", adminAuth, updateCredentials);

module.exports = router;
