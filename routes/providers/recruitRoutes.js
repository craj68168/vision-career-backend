const express = require("express");

const {
  createRecruit,
  getAllRecruits,
  getRecruitById,
  updateRecruit,
  submitRecruit,
  deleteRecruit,
} = require("../../controllers/providers/recruitController");

const providerAuth = require("../../middleware/providerAuth");

const router = express.Router();

// ======================================================
// PROVIDER PLACEMENT REQUESTS
// ======================================================

router.post("/", providerAuth, createRecruit);

router.get("/", providerAuth, getAllRecruits);

router.get("/:recruitId", providerAuth, getRecruitById);

router.put("/:recruitId", providerAuth, updateRecruit);

router.patch("/:recruitId/submit", providerAuth, submitRecruit);

router.delete("/:recruitId", providerAuth, deleteRecruit);

module.exports = router;
