const Vacancy = require("../../models/providers/vacancySchema");

const Application = require("../../models/applications/applicationSchema");

const { seekerMessage } = require("../../utils/seekerMessages");

const t = (req, en, ja) => seekerMessage(req, { en, ja });

// ======================================================
// GET START OF TODAY
// ======================================================
//
// applicationDeadline is stored as a date such as:
//
// 2026-09-16T00:00:00.000Z
//
// We treat that as valid for the whole calendar day.
//
// Example:
//
// Deadline: September 16
//
// September 16 -> AVAILABLE
// September 17 -> EXPIRED
//
// ======================================================

const getTodayStartUTC = () => {
  const today = new Date();

  today.setUTCHours(0, 0, 0, 0);

  return today;
};

// ======================================================
// SEEKER-SAFE VACANCY FORMAT
// ======================================================
//
// IMPORTANT:
//
// Never expose:
//
// - registerId
// - contactPerson
// - contactPersonKana
// - contactEmail
// - workLocationDetail
// - reviewedAt
// - rejectionReason
//
// ======================================================

const toPublicVacancy = (vacancy) => {
  return {
    // ==================================================
    // ID
    // ==================================================

    vacancyId: vacancy.vacancyId,

    // ==================================================
    // COMPANY
    // ==================================================

    companyName: vacancy.companyName,

    companyNameKana: vacancy.companyNameKana,

    // ==================================================
    // POSITION
    // ==================================================

    title: vacancy.title,

    titleKana: vacancy.titleKana,

    employmentType: vacancy.employmentType,

    numberOfPeople: vacancy.numberOfPeople,

    // ==================================================
    // JOB DESCRIPTION
    // ==================================================

    jobDescription: vacancy.jobDescription,

    responsibilities: vacancy.responsibilities,

    // ==================================================
    // REQUIREMENTS
    // ==================================================

    requiredSkills: vacancy.requiredSkills,

    preferredSkills: vacancy.preferredSkills,

    requiredEducation: vacancy.requiredEducation,

    requiredExperience: vacancy.requiredExperience,

    japaneseLevel: vacancy.japaneseLevel,

    // ==================================================
    // LOCATION
    // ==================================================

    workLocation: vacancy.workLocation,

    remoteWork: vacancy.remoteWork,

    // ==================================================
    // SALARY
    // ==================================================

    salaryMin: vacancy.salaryMin,

    salaryMax: vacancy.salaryMax,

    salaryNote: vacancy.salaryNote,

    // ==================================================
    // WORK CONDITIONS
    // ==================================================

    workHours: vacancy.workHours,

    breakTime: vacancy.breakTime,

    overtime: vacancy.overtime,

    holidays: vacancy.holidays,

    // ==================================================
    // BENEFITS
    // ==================================================

    benefits: vacancy.benefits || [],

    insurance: vacancy.insurance || [],

    trialPeriod: vacancy.trialPeriod,

    // ==================================================
    // APPLICATION
    // ==================================================

    applicationDeadline: vacancy.applicationDeadline,

    startDate: vacancy.startDate,

    selectionProcess: vacancy.selectionProcess,

    // ==================================================
    // PUBLIC STATUS
    // ==================================================

    status: vacancy.status,

    createdAt: vacancy.createdAt,
  };
};

// ======================================================
// GET AVAILABLE VACANCIES
//
// GET /api/seekers/vacancies
//
// CONDITIONS:
//
// 1. Published
// 2. isPublished = true
// 3. Deadline has not passed
// 4. Seeker has not already applied
//
// ======================================================

exports.getPublishedVacancies = async (req, res) => {
  try {
    const seekerId = req.user.seeker_id;

    // ================================================
    // GET VACANCIES ALREADY APPLIED TO
    // ================================================

    const appliedVacancyIds = await Application.distinct("vacancy_id", {
      seeker_id: seekerId,
    });

    // ================================================
    // TODAY START
    // ================================================

    const todayStart = getTodayStartUTC();

    // ================================================
    // FIND AVAILABLE VACANCIES
    // ================================================

    const vacancies = await Vacancy.find({
      status: "published",

      isPublished: true,

      vacancyId: {
        $nin: appliedVacancyIds,
      },

      $or: [
        // ------------------------------------------
        // No deadline
        // ------------------------------------------

        {
          applicationDeadline: null,
        },

        // ------------------------------------------
        // Deadline today or future
        // ------------------------------------------

        {
          applicationDeadline: {
            $gte: todayStart,
          },
        },
      ],
    }).sort({
      createdAt: -1,
    });

    // ================================================
    // RESPONSE
    // ================================================

    return res.status(200).json({
      success: true,

      count: vacancies.length,

      data: vacancies.map(toPublicVacancy),
    });
  } catch (error) {
    console.error("Get published vacancies error:", error);

    return res.status(500).json({
      success: false,

      message: t(req, "Failed to get vacancies.", "求人情報の取得に失敗しました。"),
    });
  }
};

// ======================================================
// GET ONE PUBLISHED VACANCY
//
// GET /api/seekers/vacancies/:vacancyId
//
// ======================================================

exports.getPublishedVacancyById = async (req, res) => {
  try {
    const { vacancyId } = req.params;

    // ================================================
    // FIND VACANCY
    // ================================================

    const vacancy = await Vacancy.findOne({
      vacancyId,

      status: "published",

      isPublished: true,
    });

    if (!vacancy) {
      return res.status(404).json({
        success: false,

        message: t(req, "Vacancy not found.", "求人情報が見つかりません。"),
      });
    }

    // ================================================
    // CHECK DEADLINE
    // ================================================

    const todayStart = getTodayStartUTC();

    if (
      vacancy.applicationDeadline &&
      vacancy.applicationDeadline < todayStart
    ) {
      return res.status(410).json({
        success: false,

        message: t(
          req,
          "The application deadline for this vacancy has passed.",
          "この求人の応募期限は終了しています。",
        ),
      });
    }

    // ================================================
    // RESPONSE
    // ================================================

    return res.status(200).json({
      success: true,

      data: toPublicVacancy(vacancy),
    });
  } catch (error) {
    console.error("Get published vacancy error:", error);

    return res.status(500).json({
      success: false,

      message: t(req, "Failed to get vacancy.", "求人情報の取得に失敗しました。"),
    });
  }
};
