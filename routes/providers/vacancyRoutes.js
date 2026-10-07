const express = require("express");

const {
  createVacancy,
  getAllVacancies,
  getPublicVacancies,
  getPublicVacancyById,
  getVacancyById,
  updateVacancy,
  deleteVacancy,
  approveVacancy,
  rejectVacancy,
  publishVacancy,
  closeVacancy,
} = require("../../controllers/providers/vacancyController");

const providerAuth = require("../../middleware/providerAuth");

const providerProfileComplete = require("../../middleware/providerProfileComplete");

const router = express.Router();

// ======================================================
// PROVIDER CREATE VACANCY
//
// Provider must:
// 1. be authenticated / active
// 2. have a complete company profile
//
// POST /api/providers/vacancies
// ======================================================

router.post("/", providerAuth, providerProfileComplete, createVacancy);

// ======================================================
// PROVIDER'S VACANCIES
// GET /api/providers/vacancies
//
// Viewing existing vacancies remains allowed even if
// the profile later becomes incomplete.
// ======================================================

router.get("/", providerAuth, getAllVacancies);

// ======================================================
// PUBLIC / SEEKER
// GET /api/providers/vacancies/public
// ======================================================

router.get("/public", getPublicVacancies);
router.get("/public/:id", getPublicVacancyById);

// ======================================================
// ADMIN STATUS
//
// Later these should be moved to Admin routes and
// protected by Admin middleware.
// ======================================================

router.put("/approve/:id", approveVacancy);

router.put("/reject/:id", rejectVacancy);

router.put("/publish/:id", publishVacancy);

router.put("/close/:id", closeVacancy);

// ======================================================
// PROVIDER SINGLE
// ======================================================

router.get("/:id", providerAuth, getVacancyById);

// ======================================================
// PROVIDER UPDATE / RESUBMIT VACANCY
//
// Updating a vacancy currently sends it back to
// pending_review.
//
// Because that is effectively another submission,
// a complete Provider profile is required.
// ======================================================

router.put("/:id", providerAuth, providerProfileComplete, updateVacancy);

// ======================================================
// DELETE
//
// Existing vacancy deletion remains available.
// ======================================================

router.delete("/:id", providerAuth, deleteVacancy);

module.exports = router;
