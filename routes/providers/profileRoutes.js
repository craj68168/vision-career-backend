const express = require("express");
const router = express.Router();

const {
  getProfile,
  updateProfile,
} = require("../../controllers/providers/profileController");

router.get("/:registerId", getProfile);

router.put("/:registerId", updateProfile);

module.exports = router;

module.exports = router;
