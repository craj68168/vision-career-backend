const express = require("express");

const adminAuth = require("../../middleware/adminAuth");

const {
  getProviders,
  getProviderById,
  createProvider,
  updateProvider,
  updateProviderStatus,
  deleteProvider,
} = require("../../controllers/admin/providerController");

const router = express.Router();

// ======================================================
// GET ALL
// ======================================================

router.get("/", adminAuth, getProviders);

// ======================================================
// CREATE
// ======================================================

router.post("/", adminAuth, createProvider);

// ======================================================
// STATUS
// ======================================================

router.patch("/:registerId/status", adminAuth, updateProviderStatus);

// ======================================================
// GET ONE
// ======================================================

router.get("/:registerId", adminAuth, getProviderById);

// ======================================================
// UPDATE
// ======================================================

router.patch("/:registerId", adminAuth, updateProvider);

// ======================================================
// DELETE
// ======================================================

router.delete("/:registerId", adminAuth, deleteProvider);

module.exports = router;
