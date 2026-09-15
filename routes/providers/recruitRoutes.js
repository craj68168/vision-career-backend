const express = require("express");
const router = express.Router();

const {
  createRecruit,
  getAllRecruits,
  getRecruitById,
  updateRecruit,
  deleteRecruit,
  approveRecruit,
  rejectRecruit,
} = require("../../controllers/providers/recruitController");

const providerAuth = require("../../middleware/providerAuth");

// CREATE
router.post("/recruits", providerAuth, createRecruit);

// LIST
router.get("/recruits", getAllRecruits);

// SINGLE
router.get("/recruits/:recruitId", getRecruitById);

// UPDATE
router.put("/recruits/:recruitId", updateRecruit);

// DELETE
router.delete("/recruits/:recruitId", deleteRecruit);

// APPROVE
router.put("/recruits/approve/:recruitId", approveRecruit);

// REJECT
router.put("/recruits/reject/:recruitId", rejectRecruit);

module.exports = router;