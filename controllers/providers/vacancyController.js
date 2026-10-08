const Vacancy = require("../../models/providers/vacancySchema");

const Register = require("../../models/providers/registerSchema");

const Counter = require("../../models/providers/counterModel");

const {
  SEEKER_EMPLOYER_LABEL,
  toSeekerVisibleWorkLocation,
} = require("../../utils/seekerPrivacy");

// ======================================================
// PROVIDER EDITABLE STATUSES
//
// Provider may edit:
//
// draft
// pending_review
// rejected
//
// Provider may NOT edit:
//
// approved
// published
// closed
//
// Once a vacancy has been approved, the approved version
// must remain frozen.
// ======================================================

const PROVIDER_EDITABLE_STATUSES = ["draft", "pending_review", "rejected"];

// ======================================================
// PROVIDER DELETABLE STATUSES
//
// Keep approved/published/closed records for workflow
// history and audit purposes.
// ======================================================

const PROVIDER_DELETABLE_STATUSES = ["draft", "pending_review", "rejected"];

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
      returnDocument: "after",

      upsert: true,
    },
  );

  return `V-${counter.seq.toString().padStart(6, "0")}`;
};

// ======================================================
// ALLOWED PROVIDER FIELDS
//
// Provider can only modify these vacancy fields.
//
// Workflow fields are intentionally excluded:
//
// status
// isPublished
// reviewedAt
// reviewedBy...
// publishedAt
// closedAt
// staff screening
// workflow history
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
// CLEAN PROVIDER PAYLOAD
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
// PUBLIC / SEEKER-SAFE VACANCY
//
// IMPORTANT:
//
// NEVER expose:
//
// - real company name
// - Provider registerId
// - contact person
// - contact email
// - company phone
// - company website
// - exact location
// - workLocationDetail
//
// Only broad prefecture-level location is returned.
// ======================================================

const toPublicVacancy = (vacancy) => ({
  vacancyId: vacancy.vacancyId,

  companyName: SEEKER_EMPLOYER_LABEL,

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

  workLocation: toSeekerVisibleWorkLocation(vacancy.workLocation),

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

  updatedAt: vacancy.updatedAt,
});

// ======================================================
// TODAY START UTC
// ======================================================

const getTodayStartUTC = () => {
  const today = new Date();

  today.setUTCHours(0, 0, 0, 0);

  return today;
};

// ======================================================
// RESET CURRENT REVIEW STATE
//
// Used when Provider edits/resubmits:
//
// draft
// pending_review
// rejected
//
// IMPORTANT:
//
// workflow_history is NOT deleted.
//
// Historical decisions remain available to Admin/Staff.
// Only the CURRENT review state is reset.
// ======================================================

const resetReviewStateForResubmission = (vacancy) => {
  // ====================================================
  // REVIEW
  // ====================================================

  vacancy.reviewedAt = null;

  vacancy.reviewedByType = null;

  vacancy.reviewedById = null;

  vacancy.reviewedByName = null;

  vacancy.rejectionReason = null;

  // ====================================================
  // STAFF SCREENING
  //
  // Any Provider edit invalidates the previous screening,
  // because Staff screened the previous version.
  // ====================================================

  vacancy.staff_screening_status = "NOT_SCREENED";

  vacancy.staff_screening_note = null;

  vacancy.screened_by_staff_id = null;

  vacancy.screened_by_staff_name = null;

  vacancy.screened_at = null;

  // ====================================================
  // PUBLICATION
  // ====================================================

  vacancy.publishedAt = null;

  vacancy.publishedByAdminId = null;

  vacancy.publishedByAdminName = null;

  // ====================================================
  // CLOSING
  // ====================================================

  vacancy.closedAt = null;

  vacancy.closedByAdminId = null;

  vacancy.closedByAdminName = null;
};

// ======================================================
// CREATE VACANCY
//
// POST
// /api/providers/vacancies
//
// New vacancy always goes:
//
// pending_review
//
// Provider cannot choose its own status.
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

      // Always use the authenticated
      // Provider's registered company.
      companyName: register.companyName,

      status: "pending_review",

      isPublished: false,
    });

    return res.status(201).json({
      status: "success",

      message: "Vacancy submitted successfully and is pending review.",

      data: vacancy,
    });
  } catch (error) {
    console.error("CREATE VACANCY ERROR:", error);

    return res.status(500).json({
      status: "error",

      message: error.message || "Failed to create vacancy",

      errorName: error.name,

      errorCode: error.code,
    });
  }
};

// ======================================================
// GET PROVIDER VACANCIES
//
// GET
// /api/providers/vacancies
//
// Provider only gets their own vacancies.
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
    console.error("GET PROVIDER VACANCIES ERROR:", error);

    return res.status(500).json({
      status: "error",

      message: "Failed to load vacancies",
    });
  }
};

// ======================================================
// PUBLIC VACANCIES
//
// GET
// /api/providers/vacancies/public
// ======================================================

exports.getPublicVacancies = async (req, res) => {
  try {
    const todayStart = getTodayStartUTC();

    const data = await Vacancy.find({
      status: "published",

      isPublished: true,

      $or: [
        {
          applicationDeadline: null,
        },

        {
          applicationDeadline: {
            $gte: todayStart,
          },
        },
      ],
    }).sort({
      createdAt: -1,
    });

    return res.json({
      status: "success",

      count: data.length,

      data: data.map(toPublicVacancy),
    });
  } catch (error) {
    console.error("GET PUBLIC VACANCIES ERROR:", error);

    return res.status(500).json({
      status: "error",

      message: "Failed to load vacancies",
    });
  }
};

// ======================================================
// PUBLIC VACANCY DETAILS
//
// GET
// /api/providers/vacancies/public/:id
// ======================================================

exports.getPublicVacancyById = async (req, res) => {
  try {
    const todayStart = getTodayStartUTC();

    const vacancy = await Vacancy.findOne({
      vacancyId: req.params.id,

      status: "published",

      isPublished: true,

      $or: [
        {
          applicationDeadline: null,
        },

        {
          applicationDeadline: {
            $gte: todayStart,
          },
        },
      ],
    });

    if (!vacancy) {
      return res.status(404).json({
        status: "error",

        message: "Vacancy not found",
      });
    }

    return res.json({
      status: "success",

      data: toPublicVacancy(vacancy),
    });
  } catch (error) {
    console.error("GET PUBLIC VACANCY ERROR:", error);

    return res.status(500).json({
      status: "error",

      message: "Failed to load vacancy",
    });
  }
};

// ======================================================
// GET PROVIDER VACANCY
//
// GET
// /api/providers/vacancies/:id
//
// Provider can only access their own vacancy.
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
    console.error("GET PROVIDER VACANCY ERROR:", error);

    return res.status(500).json({
      status: "error",

      message: "Failed to load vacancy",
    });
  }
};

// ======================================================
// UPDATE / RESUBMIT VACANCY
//
// PUT
// /api/providers/vacancies/:id
//
// EDITABLE:
//
// draft
// pending_review
// rejected
//
// LOCKED:
//
// approved
// published
// closed
//
// Any allowed edit becomes:
//
// pending_review
//
// because Admin/Staff must review the modified version.
// ======================================================

exports.updateVacancy = async (req, res) => {
  try {
    // ==================================================
    // FIND OWN VACANCY FIRST
    //
    // We must check the existing status BEFORE updating.
    // ==================================================

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

    // ==================================================
    // LOCK APPROVED / PUBLISHED / CLOSED
    // ==================================================

    if (!PROVIDER_EDITABLE_STATUSES.includes(vacancy.status)) {
      return res.status(409).json({
        status: "error",

        code: "VACANCY_EDIT_LOCKED",

        message:
          "This vacancy can no longer be edited. Please contact Vision Career if changes are required.",

        data: {
          vacancyId: vacancy.vacancyId,

          status: vacancy.status,

          editable: false,
        },
      });
    }

    // ==================================================
    // BUILD ALLOWED UPDATE
    // ==================================================

    const payload = buildVacancyPayload(req.body);

    Object.entries(payload).forEach(([field, value]) => {
      vacancy[field] = value;
    });

    // ==================================================
    // RESUBMIT
    //
    // Even if the vacancy was rejected or was already
    // pending review, an edit creates a fresh review
    // requirement.
    // ==================================================

    vacancy.status = "pending_review";

    vacancy.isPublished = false;

    // ==================================================
    // RESET CURRENT REVIEW STATE
    //
    // Historical workflow_history remains untouched.
    // ==================================================

    resetReviewStateForResubmission(vacancy);

    await vacancy.save();

    return res.json({
      status: "success",

      message: "Vacancy updated and submitted for review.",

      data: vacancy,
    });
  } catch (error) {
    console.error("UPDATE PROVIDER VACANCY ERROR:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        status: "error",

        message: "Please check the vacancy information and try again.",
      });
    }

    return res.status(500).json({
      status: "error",

      message: "Failed to update vacancy",
    });
  }
};

// ======================================================
// DELETE VACANCY
//
// DELETE
// /api/providers/vacancies/:id
//
// Provider may delete:
//
// draft
// pending_review
// rejected
//
// Provider may NOT delete:
//
// approved
// published
// closed
//
// Published/approved/closed records should remain in
// the system for audit/history purposes.
// ======================================================

exports.deleteVacancy = async (req, res) => {
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

    if (!PROVIDER_DELETABLE_STATUSES.includes(vacancy.status)) {
      return res.status(409).json({
        status: "error",

        code: "VACANCY_DELETE_LOCKED",

        message:
          "This vacancy can no longer be deleted. Please contact Vision Career if assistance is required.",

        data: {
          vacancyId: vacancy.vacancyId,

          status: vacancy.status,

          deletable: false,
        },
      });
    }

    await Vacancy.deleteOne({
      _id: vacancy._id,
    });

    return res.json({
      status: "success",

      message: "Vacancy deleted successfully.",

      vacancyId: vacancy.vacancyId,
    });
  } catch (error) {
    console.error("DELETE PROVIDER VACANCY ERROR:", error);

    return res.status(500).json({
      status: "error",

      message: "Failed to delete vacancy",
    });
  }
};
