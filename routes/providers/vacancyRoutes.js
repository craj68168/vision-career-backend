const express = require("express");

const router = express.Router();

const {
  createVacancy,
  getVacancies,
  getVacanciesByRegisterId,
  getVacancyById,
  getVacancyByVacancyId,
  updateVacancy,
  deleteVacancy
} = require("../../controllers/providers/vacancyController");


// ==========================================
// CREATE VACANCY
// POST /api/vacancies
// ==========================================

router.post("/", createVacancy);


// ==========================================
// GET ALL VACANCIES
// GET /api/vacancies
// ==========================================

router.get("/", getVacancies);


// ==========================================
// GET VACANCIES BY REGISTER ID
// GET /api/vacancies/register/:registerId
// ==========================================

router.get(
  "/register/:registerId",
  getVacanciesByRegisterId
);


// ==========================================
// GET BY VACANCY ID
// GET /api/vacancies/vacancy/V-734643
// ==========================================

router.get(
  "/vacancy/:vacancyId",
  getVacancyByVacancyId
);


// ==========================================
// GET BY MONGODB _id
// GET /api/vacancies/:id
// ==========================================

router.get("/:id", getVacancyById);


// ==========================================
// UPDATE
// PUT /api/vacancies/:id
// ==========================================

router.put("/:id", updateVacancy);


// ==========================================
// DELETE
// DELETE /api/vacancies/:id
// ==========================================

router.delete("/:id", deleteVacancy);


module.exports = router;
