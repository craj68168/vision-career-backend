const Vacancy = require("../../models/providers/vacancySchema");
const Register = require("../../models/providers/registerSchema");

// ==========================================
// GENERATE VACANCY ID
// Format: V-734643
// ==========================================

const generateVacancyId = () => {
  const number = Math.floor(100000 + Math.random() * 900000);

  return `V-${number}`;
};


// ==========================================
// CREATE VACANCY
// ==========================================

exports.createVacancy = async (req, res) => {
  try {
    const {
      registerId,

      companyName,
      companyNameKana,
      title,
      titleKana,
      employmentType,
      numberOfPeople,
      jobDescription,
      responsibilities,
      requiredSkills,
      preferredSkills,
      requiredEducation,
      requiredExperience,
      japaneseLevel,
      workLocation,
      workLocationDetail,
      remoteWork,
      salaryMin,
      salaryMax,
      salaryNote,
      workHours,
      breakTime,
      overtime,
      holidays,
      benefits,
      insurance,
      trialPeriod,
      applicationDeadline,
      startDate,
      selectionProcess,
      contactPerson,
      contactPersonKana,
      contactEmail
    } = req.body;


    // ==========================================
    // VALIDATION
    // ==========================================

    if (!registerId) {
      return res.status(400).json({
        message: "registerId is required"
      });
    }

    if (!companyName) {
      return res.status(400).json({
        message: "companyName is required"
      });
    }

    if (!title) {
      return res.status(400).json({
        message: "title is required"
      });
    }


    // ==========================================
    // CHECK REGISTER
    // ==========================================

    const register = await Register.findOne({
      registerId
    });

    if (!register) {
      return res.status(404).json({
        message: "Register not found"
      });
    }


    // ==========================================
    // GENERATE UNIQUE VACANCY ID
    // ==========================================

    let vacancyId;
    let existingVacancy;

    do {
      vacancyId = generateVacancyId();

      existingVacancy = await Vacancy.findOne({
        vacancyId
      });

    } while (existingVacancy);


    // ==========================================
    // CREATE VACANCY
    // ==========================================

    const vacancy = await Vacancy.create({
      vacancyId,

      registerId,

      companyName,
      companyNameKana,
      title,
      titleKana,
      employmentType,
      numberOfPeople,
      jobDescription,
      responsibilities,
      requiredSkills,
      preferredSkills,
      requiredEducation,
      requiredExperience,
      japaneseLevel,
      workLocation,
      workLocationDetail,
      remoteWork,
      salaryMin,
      salaryMax,
      salaryNote,
      workHours,
      breakTime,
      overtime,
      holidays,
      benefits,
      insurance,
      trialPeriod,
      applicationDeadline,
      startDate,
      selectionProcess,
      contactPerson,
      contactPersonKana,
      contactEmail
    });


    // ==========================================
    // RESPONSE
    // ==========================================

    return res.status(201).json({
      message: "Vacancy created successfully",

      vacancy
    });

  } catch (error) {
    console.error("Create vacancy error:", error);

    return res.status(500).json({
      message: error.message
    });
  }
};


// ==========================================
// GET ALL VACANCIES
// ==========================================

exports.getVacancies = async (req, res) => {
  try {
    const vacancies = await Vacancy.find()
      .sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Vacancies fetched successfully",
      count: vacancies.length,
      vacancies
    });

  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};


// ==========================================
// GET VACANCIES BY REGISTER ID
// ==========================================

exports.getVacanciesByRegisterId = async (req, res) => {
  try {
    const { registerId } = req.params;

    const vacancies = await Vacancy.find({
      registerId
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Vacancies fetched successfully",
      registerId,
      count: vacancies.length,
      vacancies
    });

  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};


// ==========================================
// GET VACANCY BY MONGODB ID
// ==========================================

exports.getVacancyById = async (req, res) => {
  try {
    const vacancy = await Vacancy.findById(req.params.id);

    if (!vacancy) {
      return res.status(404).json({
        message: "Vacancy not found"
      });
    }

    return res.status(200).json({
      message: "Vacancy fetched successfully",
      vacancy
    });

  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};


// ==========================================
// GET VACANCY BY VACANCY ID
// Example: V-734643
// ==========================================

exports.getVacancyByVacancyId = async (req, res) => {
  try {
    const vacancy = await Vacancy.findOne({
      vacancyId: req.params.vacancyId
    });

    if (!vacancy) {
      return res.status(404).json({
        message: "Vacancy not found"
      });
    }

    return res.status(200).json({
      message: "Vacancy fetched successfully",
      vacancy
    });

  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};


// ==========================================
// UPDATE VACANCY
// ==========================================

exports.updateVacancy = async (req, res) => {
  try {
    // Do not allow these IDs to be changed
    delete req.body.vacancyId;
    delete req.body.registerId;

    const vacancy = await Vacancy.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    if (!vacancy) {
      return res.status(404).json({
        message: "Vacancy not found"
      });
    }

    return res.status(200).json({
      message: "Vacancy updated successfully",
      vacancy
    });

  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};


// ==========================================
// DELETE VACANCY
// ==========================================

exports.deleteVacancy = async (req, res) => {
  try {
    const vacancy = await Vacancy.findByIdAndDelete(
      req.params.id
    );

    if (!vacancy) {
      return res.status(404).json({
        message: "Vacancy not found"
      });
    }

    return res.status(200).json({
      message: "Vacancy deleted successfully",
      vacancyId: vacancy.vacancyId
    });

  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};
