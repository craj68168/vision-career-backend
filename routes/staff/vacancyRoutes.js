const express = require("express");

const staffAuth = require("../../middleware/staffAuth");

const requireStaffPermission = require("../../middleware/requireStaffPermission");

const {
  getStaffVacancies,
  getStaffVacancyById,
  screenVacancy,
  approveStaffVacancy,
  rejectStaffVacancy,
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

// ======================================================
// APPROVE
//
// vacancies:approval
//
// Approval does not publish the vacancy.
// ======================================================

router.patch(
  "/:vacancyId/approve",
  staffAuth,
  requireStaffPermission("vacancies:approval"),
  approveStaffVacancy,
);

// ======================================================
// REJECT
//
// vacancies:approval
// ======================================================

router.patch(
  "/:vacancyId/reject",
  staffAuth,
  requireStaffPermission("vacancies:approval"),
  rejectStaffVacancy,
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

module.exports = router;
