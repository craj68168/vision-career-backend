const express = require("express");

const staffAuth = require("../../middleware/staffAuth");

const requireStaffPermission = require("../../middleware/requireStaffPermission");

const {
  getStaffVacancies,
  getStaffVacancyById,
  screenVacancy,
} = require("../../controllers/staff/vacancyController");

const router = express.Router();

// ======================================================
// LIST
//
// vacancies:view
// ======================================================

router.get(
  "/",
  staffAuth,
  requireStaffPermission("vacancies:view"),
  getStaffVacancies,
);

// ======================================================
// DETAILS
//
// vacancies:view
// ======================================================

router.get(
  "/:vacancyId",
  staffAuth,
  requireStaffPermission("vacancies:view"),
  getStaffVacancyById,
);

// ======================================================
// SCREEN
//
// vacancies:review
// ======================================================

router.patch(
  "/:vacancyId/screen",
  staffAuth,
  requireStaffPermission("vacancies:review"),
  screenVacancy,
);

module.exports = router;
