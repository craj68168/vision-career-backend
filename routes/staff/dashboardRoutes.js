const express = require("express");

const staffAuth = require("../../middleware/staffAuth");

const {
  getStaffDashboard,
} = require("../../controllers/staff/dashboardController");

const router = express.Router();

// ======================================================
// STAFF DASHBOARD
//
// Every authenticated Staff account can access the
// Dashboard.
//
// dashboard:view is no longer required.
// ======================================================

router.get("/", staffAuth, getStaffDashboard);

module.exports = router;
