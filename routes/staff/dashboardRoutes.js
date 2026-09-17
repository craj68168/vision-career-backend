const express = require("express");

const staffAuth = require("../../middleware/staffAuth");

const requireStaffPermission = require("../../middleware/requireStaffPermission");

const {
  getStaffDashboard,
} = require("../../controllers/staff/dashboardController");

const router = express.Router();

router.get(
  "/",
  staffAuth,
  requireStaffPermission("dashboard:view"),
  getStaffDashboard,
);

module.exports = router;
