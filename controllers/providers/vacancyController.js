const Vacancy = require("../../models/providers/vacancySchema");

const Register = require("../../models/providers/registerSchema");

const Counter = require("../../models/providers/counterModel");

// ======================================================
// GENERATE VACANCY ID
// ======================================================

const generateVacancyId = async () => {
  const counter = await Counter.findByIdAndUpdate(
    {
      _id: "vacancyId",
    },

    {
      $inc: {
        seq: 1,
      },
    },

    {
      new: true,
      upsert: true,
    },
  );

  return `V-${counter.seq.toString().padStart(6, "0")}`;
};

// ======================================================
// ALLOWED PROVIDER FIELDS
// ======================================================

const VACANCY_FIELDS = [
  "companyNameKana",

  "title",
  "titleKana",

  "employmentType",
  "numberOfPeople",

  "jobDescription",
  "responsibilities",

  "requiredSkills",
  "preferredSkills",
  "requiredEducation",
  "requiredExperience",
  "japaneseLevel",

  "workLocation",
  "workLocationDetail",
  "remoteWork",

  "salaryMin",
  "salaryMax",
  "salaryNote",

  "workHours",
  "breakTime",
  "overtime",
  "holidays",

  "benefits",
  "insurance",
  "trialPeriod",

  "applicationDeadline",
  "startDate",
  "selectionProcess",

  "contactPerson",
  "contactPersonKana",
  "contactEmail",
];

// ======================================================
// CLEAN PAYLOAD
// ======================================================

const buildVacancyPayload = (body) => {
  const payload = {};

  VACANCY_FIELDS.forEach((field) => {
    if (body[field] !== undefined) {
      payload[field] = body[field];
    }
  });

  return payload;
};

// ======================================================
// PUBLIC SEEKER FORMAT
//
// IMPORTANT:
// NO email
// NO contact person
// NO private company contact details
// NO registerId
// ======================================================

const toPublicVacancy = (vacancy) => ({
  vacancyId: vacancy.vacancyId,

  title: vacancy.title,

  titleKana: vacancy.titleKana,

  employmentType: vacancy.employmentType,

  numberOfPeople: vacancy.numberOfPeople,

  jobDescription: vacancy.jobDescription,

  responsibilities: vacancy.responsibilities,

  requiredSkills: vacancy.requiredSkills,

  preferredSkills: vacancy.preferredSkills,

  requiredEducation: vacancy.requiredEducation,

  requiredExperience: vacancy.requiredExperience,

  japaneseLevel: vacancy.japaneseLevel,

  workLocation: vacancy.workLocation,

  /*
   * If workLocationDetail contains
   * exact/private location information,
   * don't expose it to seekers.
   */

  remoteWork: vacancy.remoteWork,

  salaryMin: vacancy.salaryMin,

  salaryMax: vacancy.salaryMax,

  salaryNote: vacancy.salaryNote,

  workHours: vacancy.workHours,

  breakTime: vacancy.breakTime,

  overtime: vacancy.overtime,

  holidays: vacancy.holidays,

  benefits: vacancy.benefits || [],

  insurance: vacancy.insurance || [],

  trialPeriod: vacancy.trialPeriod,

  applicationDeadline: vacancy.applicationDeadline,

  startDate: vacancy.startDate,

  selectionProcess: vacancy.selectionProcess,

  status: vacancy.status,

  isPublished: vacancy.isPublished,

  createdAt: vacancy.createdAt,
});

// ======================================================
// CREATE
// POST /api/providers/vacancies
// ======================================================

exports.createVacancy = async (req, res) => {
  try {
    const registerId = req.registerId;

    if (!registerId) {
      return res.status(401).json({
        status: "error",

        message: "Provider authentication required",
      });
    }

    const register = await Register.findOne({
      registerId,
    });

    if (!register) {
      return res.status(404).json({
        status: "error",

        message: "Provider account not found",
      });
    }

    const {
      title,
      employmentType,
      jobDescription,
      workLocation,
      contactPerson,
      contactEmail,
    } = req.body;

    if (
      !title ||
      !employmentType ||
      !jobDescription ||
      !workLocation ||
      !contactPerson ||
      !contactEmail
    ) {
      return res.status(400).json({
        status: "error",

        message: "Please complete all required vacancy fields.",
      });
    }

    const vacancyId = await generateVacancyId();

    const payload = buildVacancyPayload(req.body);

    const vacancy = await Vacancy.create({
      ...payload,

      vacancyId,

      registerId,

      // Always use authenticated
      // registered company.
      companyName: register.companyName,

      status: "pending_review",

      isPublished: false,
    });

    return res.status(201).json({
      status: "success",

      message: "Vacancy submitted successfully and is pending admin review.",

      data: vacancy,
    });
  } catch (error) {
    console.error("CREATE VACANCY ERROR:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        status: "error",

        message: error.message,
      });
    }

    return res.status(500).json({
      status: "error",

      message: "Failed to create vacancy",
    });
  }
};

// ======================================================
// PROVIDER LIST
// GET /api/providers/vacancies
// ======================================================

exports.getAllVacancies = async (req, res) => {
  try {
    const registerId = req.registerId;

    const data = await Vacancy.find({
      registerId,
    }).sort({
      createdAt: -1,
    });

    return res.json({
      status: "success",

      count: data.length,

      data,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",

      message: "Failed to load vacancies",
    });
  }
};

// ======================================================
// PUBLIC SEEKER LIST
// GET /api/providers/vacancies/public
// ======================================================

exports.getPublicVacancies = async (req, res) => {
  try {
    const data = await Vacancy.find({
      status: "published",

      isPublished: true,
    }).sort({
      createdAt: -1,
    });

    return res.json({
      status: "success",

      count: data.length,

      data: data.map(toPublicVacancy),
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",

      message: "Failed to load vacancies",
    });
  }
};

// ======================================================
// PROVIDER SINGLE
// ======================================================

exports.getVacancyById = async (req, res) => {
  try {
    const vacancy = await Vacancy.findOne({
      vacancyId: req.params.id,

      registerId: req.registerId,
    });

    if (!vacancy) {
      return res.status(404).json({
        status: "error",

        message: "Vacancy not found",
      });
    }

    return res.json({
      status: "success",

      data: vacancy,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",

      message: "Failed to load vacancy",
    });
  }
};

// ======================================================
// PROVIDER UPDATE
// ======================================================

exports.updateVacancy = async (req, res) => {
  try {
    const payload = buildVacancyPayload(req.body);

    /*
     * Editing a vacancy should
     * send it back for review.
     */

    payload.status = "pending_review";

    payload.isPublished = false;

    const vacancy = await Vacancy.findOneAndUpdate(
      {
        vacancyId: req.params.id,

        registerId: req.registerId,
      },

      {
        $set: payload,
      },

      {
        new: true,
        runValidators: true,
      },
    );

    if (!vacancy) {
      return res.status(404).json({
        status: "error",

        message: "Vacancy not found",
      });
    }

    return res.json({
      status: "success",

      message: "Vacancy updated and submitted for review.",

      data: vacancy,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",

      message: "Failed to update vacancy",
    });
  }
};

// ======================================================
// PROVIDER DELETE
// ======================================================

exports.deleteVacancy = async (req, res) => {
  try {
    const vacancy = await Vacancy.findOneAndDelete({
      vacancyId: req.params.id,

      registerId: req.registerId,
    });

    if (!vacancy) {
      return res.status(404).json({
        status: "error",

        message: "Vacancy not found",
      });
    }

    return res.json({
      status: "success",

      message: "Vacancy deleted",

      vacancyId: vacancy.vacancyId,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",

      message: "Failed to delete vacancy",
    });
  }
};

// ======================================================
// APPROVE
// ======================================================

exports.approveVacancy = async (req, res) => {
  const vacancy = await Vacancy.findOneAndUpdate(
    {
      vacancyId: req.params.id,
    },

    {
      status: "approved",

      reviewedAt: new Date(),
    },

    {
      new: true,
    },
  );

  if (!vacancy) {
    return res.status(404).json({
      status: "error",

      message: "Vacancy not found",
    });
  }

  return res.json({
    status: "success",
    data: vacancy,
  });
};

// ======================================================
// REJECT
// ======================================================

exports.rejectVacancy = async (req, res) => {
  const vacancy = await Vacancy.findOneAndUpdate(
    {
      vacancyId: req.params.id,
    },

    {
      status: "rejected",

      isPublished: false,

      rejectionReason: req.body.rejectionReason || null,

      reviewedAt: new Date(),
    },

    {
      new: true,
    },
  );

  if (!vacancy) {
    return res.status(404).json({
      status: "error",

      message: "Vacancy not found",
    });
  }

  return res.json({
    status: "success",
    data: vacancy,
  });
};

// ======================================================
// PUBLISH
// ======================================================

exports.publishVacancy = async (req, res) => {
  const vacancy = await Vacancy.findOneAndUpdate(
    {
      vacancyId: req.params.id,
    },

    {
      status: "published",

      isPublished: true,
    },

    {
      new: true,
    },
  );

  if (!vacancy) {
    return res.status(404).json({
      status: "error",

      message: "Vacancy not found",
    });
  }

  return res.json({
    status: "success",

    message: "Published successfully",

    data: toPublicVacancy(vacancy),
  });
};

// ======================================================
// CLOSE
// ======================================================

exports.closeVacancy = async (req, res) => {
  const vacancy = await Vacancy.findOneAndUpdate(
    {
      vacancyId: req.params.id,
    },

    {
      status: "closed",

      isPublished: false,
    },

    {
      new: true,
    },
  );

  if (!vacancy) {
    return res.status(404).json({
      status: "error",

      message: "Vacancy not found",
    });
  }

  return res.json({
    status: "success",
    data: vacancy,
  });
};
