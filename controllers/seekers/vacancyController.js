const Vacancy = require("../../models/providers/vacancySchema");

const Application = require("../../models/applications/applicationSchema");

const {
  SEEKER_EMPLOYER_LABEL,
  toSeekerVisibleWorkLocation,
} = require("../../utils/seekerPrivacy");

const { seekerMessage } = require("../../utils/seekerMessages");

const t = (req, en, ja) =>
  seekerMessage(req, {
    en,
    ja,
  });

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
// Job Seekers must NEVER receive enough company
// information to directly identify or contact the
// Provider.
//
// NEVER expose:
//
// - real companyName
// - companyNameKana
// - registerId
// - providerId
// - contactPerson
// - contactPersonKana
// - contactEmail
// - company phone
// - exact company address
// - workLocationDetail
// - reviewedAt
// - reviewedBy...
// - rejectionReason
// - staff screening information
// - publication audit information
// - workflow history
//
// Job Seekers receive:
//
// - Vision Career Partner Company
// - broad work location only
// - job-related information
//
// ======================================================

const toSeekerSafeVacancy = (vacancy) => {
  return {
    // ==================================================
    // PUBLIC VACANCY ID
    // ==================================================

    vacancyId: vacancy.vacancyId,

    // ==================================================
    // COMPANY
    //
    // NEVER return the real Provider/company name.
    // ==================================================

    companyName: SEEKER_EMPLOYER_LABEL,

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
    //
    // IMPORTANT:
    //
    // Only broad location is returned.
    //
    // Example:
    //
    // Original:
    // 東京都新宿区西新宿2-8-1 ABCビル
    //
    // Seeker:
    // 東京都
    //
    // Exact workLocationDetail is never returned.
    // ==================================================

    workLocation: toSeekerVisibleWorkLocation(vacancy.workLocation),

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
    // APPLICATION INFORMATION
    // ==================================================

    applicationDeadline: vacancy.applicationDeadline,

    startDate: vacancy.startDate,

    selectionProcess: vacancy.selectionProcess,

    // ==================================================
    // PUBLIC STATUS
    //
    // Only published vacancies reach this serializer,
    // but status is useful to the frontend.
    // ==================================================

    status: vacancy.status,

    createdAt: vacancy.createdAt,
  };
};

// ======================================================
// GET AVAILABLE VACANCIES
//
// GET
// /api/seekers/vacancies
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
    const seekerId = req.user?.seeker_id;

    if (!seekerId) {
      return res.status(401).json({
        success: false,

        message: t(
          req,

          "Job Seeker authentication is required.",

          "求職者としてログインしてください。",
        ),
      });
    }

    // ================================================
    // GET VACANCIES ALREADY APPLIED TO
    // ================================================

    const appliedVacancyIds = await Application.distinct(
      "vacancy_id",

      {
        seeker_id: seekerId,
      },
    );

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
    })
      .sort({
        createdAt: -1,
      })
      .lean();

    // ================================================
    // SEEKER-SAFE RESPONSE
    // ================================================

    const data = vacancies.map(toSeekerSafeVacancy);

    return res.status(200).json({
      success: true,

      count: data.length,

      data,
    });
  } catch (error) {
    console.error("GET PUBLISHED SEEKER VACANCIES ERROR:", error);

    return res.status(500).json({
      success: false,

      message: t(
        req,

        "Failed to get vacancies.",

        "求人情報の取得に失敗しました。",
      ),
    });
  }
};

// ======================================================
// GET ONE PUBLISHED VACANCY
//
// GET
// /api/seekers/vacancies/:vacancyId
//
// IMPORTANT:
//
// This endpoint follows exactly the same privacy rules
// as the vacancy list endpoint.
//
// ======================================================

exports.getPublishedVacancyById = async (req, res) => {
  try {
    const seekerId = req.user?.seeker_id;

    if (!seekerId) {
      return res.status(401).json({
        success: false,

        message: t(
          req,

          "Job Seeker authentication is required.",

          "求職者としてログインしてください。",
        ),
      });
    }

    const { vacancyId } = req.params;

    // ================================================
    // FIND VACANCY
    // ================================================

    const vacancy = await Vacancy.findOne({
      vacancyId,

      status: "published",

      isPublished: true,
    }).lean();

    if (!vacancy) {
      return res.status(404).json({
        success: false,

        message: t(
          req,

          "Vacancy not found.",

          "求人情報が見つかりません。",
        ),
      });
    }

    // ================================================
    // CHECK DEADLINE
    // ================================================

    const todayStart = getTodayStartUTC();

    if (
      vacancy.applicationDeadline &&
      new Date(vacancy.applicationDeadline) < todayStart
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
    // SEEKER-SAFE RESPONSE
    // ================================================

    return res.status(200).json({
      success: true,

      data: toSeekerSafeVacancy(vacancy),
    });
  } catch (error) {
    console.error("GET PUBLISHED SEEKER VACANCY ERROR:", error);

    return res.status(500).json({
      success: false,

      message: t(
        req,

        "Failed to get vacancy.",

        "求人情報の取得に失敗しました。",
      ),
    });
  }
};
