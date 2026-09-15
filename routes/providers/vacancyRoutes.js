const express = require("express");
const router = express.Router();

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

// CREATE
router.post("/vacancy", createVacancy);

// ADMIN
router.get("/vacancy", getAllVacancies);

// STATUS FLOW (IMPORTANT: vacancyId used here)
router.put("/approve/:id", approveVacancy);
router.put("/reject/:id", rejectVacancy);
router.put("/publish/:id", publishVacancy);
router.put("/close/:id", closeVacancy);

// PUBLIC
router.get("/public", getPublicVacancies);

// COMMON
router.get("/:id", getVacancyById);
router.put("/:id", updateVacancy);
router.delete("/:id", deleteVacancy);

module.exports = router;