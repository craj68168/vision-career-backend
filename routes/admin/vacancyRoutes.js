const express = require("express");

const adminAuth = require("../../middleware/adminAuth");

const {
  getAdminVacancies,
  getAdminVacancyById,
  approveAdminVacancy,
  rejectAdminVacancy,
  publishAdminVacancy,
  closeAdminVacancy,
} = require("../../controllers/admin/vacancyController");

const router = express.Router();

// ======================================================
// GET ALL VACANCIES
//
// GET /api/admin/vacancies
// ======================================================

router.get("/", adminAuth, getAdminVacancies);

// ======================================================
// APPROVE
//
// PATCH
// /api/admin/vacancies/:vacancyId/approve
// ======================================================

router.patch("/:vacancyId/approve", adminAuth, approveAdminVacancy);

// ======================================================
// REJECT
//
// PATCH
// /api/admin/vacancies/:vacancyId/reject
// ======================================================

router.patch("/:vacancyId/reject", adminAuth, rejectAdminVacancy);

// ======================================================
// PUBLISH
//
// PATCH
// /api/admin/vacancies/:vacancyId/publish
// ======================================================

router.patch("/:vacancyId/publish", adminAuth, publishAdminVacancy);

// ======================================================
// CLOSE
//
// PATCH
// /api/admin/vacancies/:vacancyId/close
// ======================================================

router.patch("/:vacancyId/close", adminAuth, closeAdminVacancy);

// ======================================================
// GET DETAILS
//
// Keep after the action routes.
// ======================================================

router.get("/:vacancyId", adminAuth, getAdminVacancyById);

module.exports = router;
