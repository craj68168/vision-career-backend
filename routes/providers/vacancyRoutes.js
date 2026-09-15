const express = require("express");

const {
  createVacancy,
  getAllVacancies,
  getPublicVacancies,
  getVacancyById,
  updateVacancy,
  deleteVacancy,
  approveVacancy,
  rejectVacancy,
  publishVacancy,
  closeVacancy,
} = require("../../controllers/providers/vacancyController");

const providerAuth = require("../../middleware/providerAuth");

const router = express.Router();

// ======================================================
// PROVIDER CREATE VACANCY
// POST /api/providers/vacancies
// ======================================================

router.post("/", providerAuth, createVacancy);

// ======================================================
// PROVIDER'S VACANCIES
// GET /api/providers/vacancies
// ======================================================

router.get("/", providerAuth, getAllVacancies);

// ======================================================
// PUBLIC / SEEKER
// GET /api/providers/vacancies/public
// ======================================================

router.get("/public", getPublicVacancies);

// ======================================================
// ADMIN STATUS
//
// Later these should be moved to admin routes
// and protected by admin middleware.
// ======================================================

router.put("/approve/:id", approveVacancy);

router.put("/reject/:id", rejectVacancy);

router.put("/publish/:id", publishVacancy);

router.put("/close/:id", closeVacancy);

// ======================================================
// PROVIDER SINGLE
// ======================================================

router.get("/:id", providerAuth, getVacancyById);

router.put("/:id", providerAuth, updateVacancy);

router.delete("/:id", providerAuth, deleteVacancy);

module.exports = router;
