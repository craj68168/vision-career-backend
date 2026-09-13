const express = require("express");

const {
  register,
  login,
  forgotPassword,
  verifyResetCode,
  resetPassword,
} = require("../../controllers/seekers/authController");

const router = express.Router();

// Register seeker
router.post("/register", register);

// Login seeker
router.post("/login", login);

router.post("/forgot-password", forgotPassword);

router.post("/verify-reset-code", verifyResetCode);

router.post("/reset-password", resetPassword);

module.exports = router;
