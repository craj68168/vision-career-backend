const express = require("express");

const {
  register,

  login,

  forgotPassword,

  verifyResetCode,

  resetPassword,
} = require("../../controllers/seekers/authController");

const {
  setInitialPassword,
} = require("../../controllers/seekers/accountSetupController");

const router = express.Router();

// ======================================================
// REGISTER SEEKER
// ======================================================

router.post(
  "/register",

  register,
);

// ======================================================
// LOGIN SEEKER
// ======================================================

router.post(
  "/login",

  login,
);

// ======================================================
// FORGOT PASSWORD
//
// Existing normal forgot-password flow.
// ======================================================

router.post(
  "/forgot-password",

  forgotPassword,
);

// ======================================================
// VERIFY RESET CODE
// ======================================================

router.post(
  "/verify-reset-code",

  verifyResetCode,
);

// ======================================================
// RESET EXISTING PASSWORD
// ======================================================

router.post(
  "/reset-password",

  resetPassword,
);

// ======================================================
// SET INITIAL PASSWORD
//
// Admin-created seeker account only.
//
// The secure setup token comes directly from the
// account-created email.
// ======================================================

router.post(
  "/set-password",

  setInitialPassword,
);

module.exports = router;
