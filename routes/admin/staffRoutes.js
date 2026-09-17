const express = require("express");

const adminAuth = require("../../middleware/adminAuth");

const {
  createStaff,
  getStaffList,
  getStaffById,
  updateStaff,
  resetStaffPassword,
  getStaffPermissionOptions,
} = require("../../controllers/admin/staffController");

const router = express.Router();

// ======================================================
// ALL ADMIN STAFF ROUTES REQUIRE ADMIN AUTH
// ======================================================

router.use(adminAuth);

// ======================================================
// PERMISSION OPTIONS
// ======================================================

router.get("/permissions/options", getStaffPermissionOptions);

// ======================================================
// STAFF LIST
// ======================================================

router.get("/", getStaffList);

// ======================================================
// CREATE STAFF
// ======================================================

router.post("/", createStaff);

// ======================================================
// GET ONE
// ======================================================

router.get("/:staffId", getStaffById);

// ======================================================
// UPDATE
// ======================================================

router.patch("/:staffId", updateStaff);

// ======================================================
// RESET PASSWORD
// ======================================================

router.patch("/:staffId/password", resetStaffPassword);

module.exports = router;
