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

const providerProfileComplete = require("../../middleware/providerProfileComplete");

const router = express.Router();

// ======================================================
// PROVIDER PLACEMENT REQUESTS
// ======================================================

// ======================================================
// CREATE PLACEMENT REQUEST
//
// A Provider must complete the company profile before
// starting a new Placement Request.
// ======================================================

router.post("/", providerAuth, providerProfileComplete, createRecruit);

// ======================================================
// VIEW EXISTING REQUESTS
//
// Existing records stay accessible even if a profile
// later becomes incomplete.
// ======================================================

router.get("/", providerAuth, getAllRecruits);

router.get("/:recruitId", providerAuth, getRecruitById);

// ======================================================
// EDIT DRAFT / REJECTED REQUEST
//
// Editing is allowed.
//
// The Provider cannot actually submit/resubmit it until
// the company profile is complete.
// ======================================================

router.put("/:recruitId", providerAuth, updateRecruit);

// ======================================================
// SUBMIT / RESUBMIT
//
// Profile completion is enforced here again.
//
// This protects direct API calls even if someone tries
// to bypass the frontend.
// ======================================================

router.patch(
  "/:recruitId/submit",
  providerAuth,
  providerProfileComplete,
  submitRecruit,
);

// ======================================================
// DELETE
// ======================================================

router.delete("/:recruitId", providerAuth, deleteRecruit);

module.exports = router;
