const express = require("express");
const router = express.Router();

const { register } = require("../../controllers/providers/registerController");

// REGISTER ROUTE
router.post("/register", register);

module.exports = router;