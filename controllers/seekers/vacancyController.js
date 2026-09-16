const Vacancy = require(
  "../../models/providers/vacancySchema",
);

const Application = require(
  "../../models/applications/applicationSchema",
);

// ======================================================
// SEEKER-SAFE VACANCY FORMAT
// ======================================================

const toPublicVacancy = (vacancy) => {
  return {
    vacancyId: vacancy.vacancyId,

    title: vacancy.title,
    titleKana: vacancy.titleKana,

    employmentType:
      vacancy.employmentType,

    numberOfPeople:
      vacancy.numberOfPeople,

    jobDescription:
      vacancy.jobDescription,

    responsibilities:
      vacancy.responsibilities,

    requiredSkills:
      vacancy.requiredSkills,

    preferredSkills:
      vacancy.preferredSkills,

    requiredEducation:
      vacancy.requiredEducation,

    requiredExperience:
      vacancy.requiredExperience,

    japaneseLevel:
      vacancy.japaneseLevel,

    workLocation:
      vacancy.workLocation,

    salaryMin:
      vacancy.salaryMin,

    salaryMax:
      vacancy.salaryMax,

    benefits:
      vacancy.benefits || [],

    insurance:
      vacancy.insurance || [],

    status:
      vacancy.status,
  };
};

// ======================================================
// GET AVAILABLE PUBLISHED VACANCIES
// GET /api/seekers/vacancies
//
// Excludes vacancies already applied to by this seeker.
// ======================================================

exports.getPublishedVacancies = async (
  req,
  res,
) => {
  try {
    // Logged-in seeker from JWT
    const seekerId = req.user.seeker_id;

    // --------------------------------------------------
    // Find vacancy IDs already applied to
    // --------------------------------------------------

    const appliedVacancyIds =
      await Application.distinct(
        "vacancy_id",
        {
          seeker_id: seekerId,
        },
      );

    // --------------------------------------------------
    // Return only:
    // - published vacancies
    // - actually public vacancies
    // - vacancies not already applied to
    // --------------------------------------------------

    const vacancies =
      await Vacancy.find({
        status: "published",
        isPublished: true,

        vacancyId: {
          $nin: appliedVacancyIds,
        },
      }).sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: vacancies.length,

      data: vacancies.map(
        toPublicVacancy,
      ),
    });
  } catch (error) {
    console.error(
      "Get published vacancies error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to get vacancies.",
    });
  }
};


// ======================================================
// GET ONE PUBLISHED VACANCY
// GET /api/seekers/vacancies/:vacancyId
// ======================================================

exports.getPublishedVacancyById =
  async (req, res) => {
    try {
      const { vacancyId } =
        req.params;

      const vacancy =
        await Vacancy.findOne({
          vacancyId,
          status: "published",
          isPublished: true,
        });

      if (!vacancy) {
        return res.status(404).json({
          success: false,
          message:
            "Vacancy not found.",
        });
      }

      return res.status(200).json({
        success: true,
        data:
          toPublicVacancy(
            vacancy,
          ),
      });
    } catch (error) {
      console.error(
        "Get vacancy error:",
        error,
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to get vacancy.",
      });
    }
  };