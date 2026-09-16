const Vacancy = require("../../models/providers/vacancySchema");
const Provider = require("../../models/providers/registerSchema");

// ======================================================
// ALLOWED STATUSES
// ======================================================

const VACANCY_STATUSES = [
  "draft",
  "pending_review",
  "approved",
  "rejected",
  "published",
  "closed",
];

// ======================================================
// PROVIDER MAP
// ======================================================

const getProviderMap = async (vacancies) => {
  const registerIds = [
    ...new Set(vacancies.map((vacancy) => vacancy.registerId).filter(Boolean)),
  ];

  if (registerIds.length === 0) {
    return new Map();
  }

  const providers = await Provider.find({
    registerId: {
      $in: registerIds,
    },
  }).lean();

  return new Map(providers.map((provider) => [provider.registerId, provider]));
};

// ======================================================
// LIST SERIALIZER
// ======================================================

const toVacancyListItem = (vacancy, provider) => {
  return {
    vacancyId: vacancy.vacancyId,

    registerId: vacancy.registerId,

    companyName: vacancy.companyName,

    companyNameKana: vacancy.companyNameKana,

    title: vacancy.title,

    titleKana: vacancy.titleKana,

    employmentType: vacancy.employmentType,

    numberOfPeople: vacancy.numberOfPeople,

    japaneseLevel: vacancy.japaneseLevel,

    workLocation: vacancy.workLocation,

    remoteWork: vacancy.remoteWork,

    salaryMin: vacancy.salaryMin,

    salaryMax: vacancy.salaryMax,

    applicationDeadline: vacancy.applicationDeadline,

    status: vacancy.status,

    isPublished: vacancy.isPublished,

    reviewedAt: vacancy.reviewedAt,

    rejectionReason: vacancy.rejectionReason,

    createdAt: vacancy.createdAt,

    updatedAt: vacancy.updatedAt,

    provider: {
      registerId: provider?.registerId || vacancy.registerId,

      name: provider?.name || null,

      companyName: provider?.companyName || vacancy.companyName,

      email: provider?.email || null,
    },
  };
};

// ======================================================
// FULL DETAILS SERIALIZER
// ======================================================

const toVacancyDetails = (vacancy, provider) => {
  return {
    vacancyId: vacancy.vacancyId,

    registerId: vacancy.registerId,

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
    // DESCRIPTION
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
    // LOCATION / SALARY
    // ==================================================

    workLocation: vacancy.workLocation,

    workLocationDetail: vacancy.workLocationDetail,

    remoteWork: vacancy.remoteWork,

    salaryMin: vacancy.salaryMin,

    salaryMax: vacancy.salaryMax,

    salaryNote: vacancy.salaryNote,

    // ==================================================
    // SCHEDULE
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
    // PRIVATE CONTACT
    //
    // ADMIN MAY SEE THESE.
    // SEEKER MUST NEVER RECEIVE THESE.
    // ==================================================

    contactPerson: vacancy.contactPerson,

    contactPersonKana: vacancy.contactPersonKana,

    contactEmail: vacancy.contactEmail,

    // ==================================================
    // REVIEW
    // ==================================================

    status: vacancy.status,

    isPublished: vacancy.isPublished,

    reviewedAt: vacancy.reviewedAt,

    rejectionReason: vacancy.rejectionReason,

    createdAt: vacancy.createdAt,

    updatedAt: vacancy.updatedAt,

    provider: {
      registerId: provider?.registerId || vacancy.registerId,

      name: provider?.name || null,

      companyName: provider?.companyName || vacancy.companyName,

      email: provider?.email || null,
    },
  };
};

// ======================================================
// SUMMARY
// ======================================================

const getVacancySummary = async () => {
  const [total, draft, pendingReview, approved, rejected, published, closed] =
    await Promise.all([
      Vacancy.countDocuments(),

      Vacancy.countDocuments({
        status: "draft",
      }),

      Vacancy.countDocuments({
        status: "pending_review",
      }),

      Vacancy.countDocuments({
        status: "approved",
      }),

      Vacancy.countDocuments({
        status: "rejected",
      }),

      Vacancy.countDocuments({
        status: "published",
        isPublished: true,
      }),

      Vacancy.countDocuments({
        status: "closed",
      }),
    ]);

  return {
    total,
    draft,
    pendingReview,
    approved,
    rejected,
    published,
    closed,
  };
};

// ======================================================
// GET ADMIN VACANCIES
//
// GET /api/admin/vacancies
// ======================================================

exports.getAdminVacancies = async (req, res) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : "";

    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";

    const query = {};

    if (status && VACANCY_STATUSES.includes(status)) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        {
          vacancyId: {
            $regex: search,
            $options: "i",
          },
        },

        {
          title: {
            $regex: search,
            $options: "i",
          },
        },

        {
          titleKana: {
            $regex: search,
            $options: "i",
          },
        },

        {
          companyName: {
            $regex: search,
            $options: "i",
          },
        },

        {
          employmentType: {
            $regex: search,
            $options: "i",
          },
        },

        {
          workLocation: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    const vacancies = await Vacancy.find(query)
      .sort({
        createdAt: -1,
      })
      .lean();

    const providerMap = await getProviderMap(vacancies);

    const data = vacancies.map((vacancy) =>
      toVacancyListItem(
        vacancy,

        providerMap.get(vacancy.registerId),
      ),
    );

    const summary = await getVacancySummary();

    return res.status(200).json({
      success: true,

      count: data.length,

      summary,

      data,
    });
  } catch (error) {
    console.error("GET ADMIN VACANCIES ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load vacancies.",
    });
  }
};

// ======================================================
// GET ONE VACANCY
//
// GET /api/admin/vacancies/:vacancyId
// ======================================================

exports.getAdminVacancyById = async (req, res) => {
  try {
    const { vacancyId } = req.params;

    const vacancy = await Vacancy.findOne({
      vacancyId,
    }).lean();

    if (!vacancy) {
      return res.status(404).json({
        success: false,

        message: "Vacancy not found.",
      });
    }

    const provider = await Provider.findOne({
      registerId: vacancy.registerId,
    }).lean();

    return res.status(200).json({
      success: true,

      data: toVacancyDetails(vacancy, provider),
    });
  } catch (error) {
    console.error("GET ADMIN VACANCY DETAILS ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load vacancy details.",
    });
  }
};

// ======================================================
// APPROVE
//
// pending_review -> approved
//
// PATCH /api/admin/vacancies/:vacancyId/approve
// ======================================================

exports.approveAdminVacancy = async (req, res) => {
  try {
    const { vacancyId } = req.params;

    const vacancy = await Vacancy.findOne({
      vacancyId,
    });

    if (!vacancy) {
      return res.status(404).json({
        success: false,

        message: "Vacancy not found.",
      });
    }

    if (vacancy.status !== "pending_review") {
      return res.status(409).json({
        success: false,

        message: "Only vacancies pending review can be approved.",
      });
    }

    vacancy.status = "approved";

    vacancy.isPublished = false;

    vacancy.reviewedAt = new Date();

    vacancy.rejectionReason = null;

    await vacancy.save();

    return res.status(200).json({
      success: true,

      message: "Vacancy approved successfully.",

      data: {
        vacancyId: vacancy.vacancyId,

        status: vacancy.status,

        isPublished: vacancy.isPublished,

        reviewedAt: vacancy.reviewedAt,
      },
    });
  } catch (error) {
    console.error("APPROVE ADMIN VACANCY ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to approve vacancy.",
    });
  }
};

// ======================================================
// REJECT
//
// pending_review -> rejected
//
// PATCH /api/admin/vacancies/:vacancyId/reject
// ======================================================

exports.rejectAdminVacancy = async (req, res) => {
  try {
    const { vacancyId } = req.params;

    const reason =
      typeof req.body.reason === "string" ? req.body.reason.trim() : "";

    if (!reason) {
      return res.status(400).json({
        success: false,

        message: "Rejection reason is required.",
      });
    }

    if (reason.length > 1000) {
      return res.status(400).json({
        success: false,

        message: "Rejection reason cannot exceed 1000 characters.",
      });
    }

    const vacancy = await Vacancy.findOne({
      vacancyId,
    });

    if (!vacancy) {
      return res.status(404).json({
        success: false,

        message: "Vacancy not found.",
      });
    }

    if (vacancy.status !== "pending_review") {
      return res.status(409).json({
        success: false,

        message: "Only vacancies pending review can be rejected.",
      });
    }

    vacancy.status = "rejected";

    vacancy.isPublished = false;

    vacancy.reviewedAt = new Date();

    vacancy.rejectionReason = reason;

    await vacancy.save();

    return res.status(200).json({
      success: true,

      message: "Vacancy rejected.",

      data: {
        vacancyId: vacancy.vacancyId,

        status: vacancy.status,

        isPublished: vacancy.isPublished,

        reviewedAt: vacancy.reviewedAt,

        rejectionReason: vacancy.rejectionReason,
      },
    });
  } catch (error) {
    console.error("REJECT ADMIN VACANCY ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to reject vacancy.",
    });
  }
};

// ======================================================
// PUBLISH
//
// approved -> published
//
// PATCH /api/admin/vacancies/:vacancyId/publish
// ======================================================

exports.publishAdminVacancy = async (req, res) => {
  try {
    const { vacancyId } = req.params;

    const vacancy = await Vacancy.findOne({
      vacancyId,
    });

    if (!vacancy) {
      return res.status(404).json({
        success: false,

        message: "Vacancy not found.",
      });
    }

    if (vacancy.status !== "approved") {
      return res.status(409).json({
        success: false,

        message: "Only approved vacancies can be published.",
      });
    }

    vacancy.status = "published";

    vacancy.isPublished = true;

    vacancy.rejectionReason = null;

    await vacancy.save();

    return res.status(200).json({
      success: true,

      message: "Vacancy published successfully.",

      data: {
        vacancyId: vacancy.vacancyId,

        status: vacancy.status,

        isPublished: vacancy.isPublished,
      },
    });
  } catch (error) {
    console.error("PUBLISH ADMIN VACANCY ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to publish vacancy.",
    });
  }
};

// ======================================================
// CLOSE
//
// published -> closed
//
// PATCH /api/admin/vacancies/:vacancyId/close
// ======================================================

exports.closeAdminVacancy = async (req, res) => {
  try {
    const { vacancyId } = req.params;

    const vacancy = await Vacancy.findOne({
      vacancyId,
    });

    if (!vacancy) {
      return res.status(404).json({
        success: false,

        message: "Vacancy not found.",
      });
    }

    if (vacancy.status !== "published") {
      return res.status(409).json({
        success: false,

        message: "Only published vacancies can be closed.",
      });
    }

    vacancy.status = "closed";

    vacancy.isPublished = false;

    await vacancy.save();

    return res.status(200).json({
      success: true,

      message: "Vacancy closed successfully.",

      data: {
        vacancyId: vacancy.vacancyId,

        status: vacancy.status,

        isPublished: vacancy.isPublished,
      },
    });
  } catch (error) {
    console.error("CLOSE ADMIN VACANCY ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to close vacancy.",
    });
  }
};
