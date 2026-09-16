const express = require("express");

const adminAuth = require("../../middleware/adminAuth");

const {
  getAdminDashboard,
} = require("../../controllers/admin/dashboardController");

const router = express.Router();

// ======================================================
// ADMIN DASHBOARD
//
// GET /api/admin/dashboard
// ======================================================

router.get("/", adminAuth, getAdminDashboard);

module.exports = router;
