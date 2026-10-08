const express = require("express");

const {
  createVacancy,
  getAllVacancies,
  getPublicVacancies,
  getPublicVacancyById,
  getVacancyById,
  updateVacancy,
  deleteVacancy,
} = require("../../controllers/providers/vacancyController");

const providerAuth = require("../../middleware/providerAuth");

const providerProfileComplete = require("../../middleware/providerProfileComplete");

const router = express.Router();

// ======================================================
// PUBLIC VACANCY ROUTES
//
// IMPORTANT:
//
// These routes MUST stay before:
//
// /:id
//
// Otherwise Express could interpret:
//
// /public
//
// as:
//
// id = "public"
// ======================================================

// ======================================================
// PUBLIC VACANCY LIST
//
// GET
// /api/providers/vacancies/public
//
// No authentication required.
//
// Response must already be filtered by the
// seeker-safe serializer:
//
// - real company name hidden
// - contact information hidden
// - exact location hidden
// ======================================================

router.get(
  "/public",

  getPublicVacancies,
);

// ======================================================
// PUBLIC VACANCY DETAILS
//
// GET
// /api/providers/vacancies/public/:id
//
// No authentication required.
// ======================================================

router.get(
  "/public/:id",

  getPublicVacancyById,
);

// ======================================================
// PROVIDER CREATE VACANCY
//
// POST
// /api/providers/vacancies
//
// Provider must:
//
// 1. be authenticated
// 2. have an active account
// 3. have a complete company profile
//
// New vacancy must enter:
//
// pending_review
//
// Provider cannot approve or publish its own vacancy.
// ======================================================

router.post(
  "/",

  providerAuth,

  providerProfileComplete,

  createVacancy,
);

// ======================================================
// PROVIDER VACANCY LIST
//
// GET
// /api/providers/vacancies
//
// Provider can only receive vacancies belonging to
// their authenticated registerId.
//
// Viewing existing vacancies remains allowed even if
// the company profile later becomes incomplete.
// ======================================================

router.get(
  "/",

  providerAuth,

  getAllVacancies,
);

// ======================================================
// PROVIDER SINGLE VACANCY
//
// GET
// /api/providers/vacancies/:id
//
// Controller must verify:
//
// vacancy.registerId === req.registerId
// ======================================================

router.get(
  "/:id",

  providerAuth,

  getVacancyById,
);

// ======================================================
// PROVIDER UPDATE / RESUBMIT VACANCY
//
// PUT
// /api/providers/vacancies/:id
//
// Editing/resubmitting a vacancy requires:
//
// - Provider authentication
// - complete Provider profile
//
// The controller sends the vacancy back to:
//
// pending_review
//
// and:
//
// isPublished = false
//
// Provider cannot edit a vacancy and keep it published.
// ======================================================

router.put(
  "/:id",

  providerAuth,

  providerProfileComplete,

  updateVacancy,
);

// ======================================================
// PROVIDER DELETE VACANCY
//
// DELETE
// /api/providers/vacancies/:id
//
// Controller must restrict deletion to the authenticated
// Provider's own vacancy.
// ======================================================

router.delete(
  "/:id",

  providerAuth,

  deleteVacancy,
);

// ======================================================
// IMPORTANT
//
// DO NOT add any of these routes here:
//
// PUT /approve/:id
// PUT /reject/:id
// PUT /publish/:id
// PUT /close/:id
//
// A Provider must NEVER be able to:
//
// - approve their own vacancy
// - reject review decisions
// - publish their own vacancy
// - perform Admin/Staff workflow actions
//
// Those actions belong only to protected Admin / Staff
// routes.
// ======================================================

module.exports = router;
