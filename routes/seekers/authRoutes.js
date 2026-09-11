const express = require("express");

const {
  register,
  login,
} = require("../../controllers/seekers/authController");

const router = express.Router();

// Register seeker
router.post("/register", register);

// Login seeker
router.post("/login", login);

module.exports = router;