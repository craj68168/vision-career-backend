const express = require("express");

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

const router = express.Router();

// POST /api/providers/recruits
router.post("/", providerAuth, createRecruit);

// GET /api/providers/recruits
router.get("/", providerAuth, getAllRecruits);

// GET /api/providers/recruits/R-XXXX
router.get("/:recruitId", providerAuth, getRecruitById);

// PUT /api/providers/recruits/R-XXXX
router.put("/:recruitId", providerAuth, updateRecruit);

// DELETE /api/providers/recruits/R-XXXX
router.delete("/:recruitId", providerAuth, deleteRecruit);

// ADMIN — move later
router.put("/approve/:recruitId", approveRecruit);

router.put("/reject/:recruitId", rejectRecruit);

module.exports = router;
