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
// ACTOR
// ======================================================

const getAdminActor = (req) => ({
  type: "admin",

  id:
    req.admin?.adminId || req.admin?.id || req.admin?._id?.toString?.() || null,

  name: req.admin?.name || req.admin?.fullName || req.admin?.email || "Admin",
});

// ======================================================
// WORKFLOW HISTORY
// ======================================================

const addWorkflowHistory = (
  vacancy,
  { action, fromStatus, toStatus, actor, reason = null, note = null },
) => {
  if (!Array.isArray(vacancy.workflow_history)) {
    vacancy.workflow_history = [];
  }

  vacancy.workflow_history.push({
    action,

    from_status: fromStatus || null,

    to_status: toStatus || null,

    actor_type: actor.type,

    actor_id: actor.id,

    actor_name: actor.name,

    reason,

    note,

    created_at: new Date(),
  });
};

// ======================================================
// STAFF SCREENING SERIALIZER
// ======================================================

const serializeStaffScreening = (vacancy) => ({
  status: vacancy.staff_screening_status || "NOT_SCREENED",

  note: vacancy.staff_screening_note || null,

  screenedByStaffId: vacancy.screened_by_staff_id || null,

  screenedByStaffName: vacancy.screened_by_staff_name || null,

  screenedAt: vacancy.screened_at || null,
});

// ======================================================
// REVIEW SERIALIZER
// ======================================================

const serializeReview = (vacancy) => ({
  reviewedAt: vacancy.reviewedAt || null,

  reviewedByType: vacancy.reviewedByType || null,

  reviewedById: vacancy.reviewedById || null,

  reviewedByName: vacancy.reviewedByName || null,

  rejectionReason: vacancy.rejectionReason || null,
});

// ======================================================
// PUBLICATION SERIALIZER
// ======================================================

const serializePublication = (vacancy) => ({
  publishedAt: vacancy.publishedAt || null,

  publishedByAdminId: vacancy.publishedByAdminId || null,

  publishedByAdminName: vacancy.publishedByAdminName || null,
});

// ======================================================
// CLOSING SERIALIZER
// ======================================================

const serializeClosing = (vacancy) => ({
  closedAt: vacancy.closedAt || null,

  closedByAdminId: vacancy.closedByAdminId || null,

  closedByAdminName: vacancy.closedByAdminName || null,
});

// ======================================================
// HISTORY SERIALIZER
// ======================================================

const serializeWorkflowHistory = (vacancy) => {
  const history = Array.isArray(vacancy.workflow_history)
    ? vacancy.workflow_history
    : [];

  return history
    .map((entry) => ({
      id: entry._id ? String(entry._id) : null,

      action: entry.action,

      fromStatus: entry.from_status || null,

      toStatus: entry.to_status || null,

      actorType: entry.actor_type,

      actorId: entry.actor_id || null,

      actorName: entry.actor_name || null,

      reason: entry.reason || null,

      note: entry.note || null,

      createdAt: entry.created_at || null,
    }))
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;

      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;

      return bTime - aTime;
    });
};

// ======================================================
// PROVIDER INTERNAL DETAILS
// ======================================================

const serializeProvider = (provider, vacancy) => ({
  registerId: provider?.registerId || vacancy.registerId,

  name: provider?.name || null,

  companyName: provider?.companyName || vacancy.companyName,

  email: provider?.email || null,

  phone: provider?.phone || null,

  address: provider?.address || null,

  industry: provider?.industry || null,

  contactPerson: provider?.contact_person || null,

  contactPersonPhone: provider?.contact_person_phone || null,

  contactPersonEmail: provider?.contact_person_email || null,

  website: provider?.website || null,

  hiringNeeds: provider?.hiring_needs || null,

  notes: provider?.notes || null,
});

// ======================================================
// PROVIDER MAP
// ======================================================

const getProviderMap = async (vacancies) => {
  const registerIds = [
    ...new Set(vacancies.map((vacancy) => vacancy.registerId).filter(Boolean)),
  ];

  if (!registerIds.length) {
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

const toVacancyListItem = (vacancy, provider) => ({
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

  review: serializeReview(vacancy),

  publication: serializePublication(vacancy),

  closing: serializeClosing(vacancy),

  staffScreening: serializeStaffScreening(vacancy),

  createdAt: vacancy.createdAt,

  updatedAt: vacancy.updatedAt,

  provider: {
    registerId: provider?.registerId || vacancy.registerId,

    name: provider?.name || null,

    companyName: provider?.companyName || vacancy.companyName,

    email: provider?.email || null,
  },
});

// ======================================================
// DETAILS SERIALIZER
// ======================================================

const toVacancyDetails = (vacancy, provider) => ({
  vacancyId: vacancy.vacancyId,

  registerId: vacancy.registerId,

  companyName: vacancy.companyName,

  companyNameKana: vacancy.companyNameKana,

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

  workLocationDetail: vacancy.workLocationDetail,

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

  // ====================================================
  // PRIVATE INTERNAL CONTACT
  // ====================================================

  contactPerson: vacancy.contactPerson,

  contactPersonKana: vacancy.contactPersonKana,

  contactEmail: vacancy.contactEmail,

  status: vacancy.status,

  isPublished: vacancy.isPublished,

  review: serializeReview(vacancy),

  publication: serializePublication(vacancy),

  closing: serializeClosing(vacancy),

  staffScreening: serializeStaffScreening(vacancy),

  workflowHistory: serializeWorkflowHistory(vacancy),

  createdAt: vacancy.createdAt,

  updatedAt: vacancy.updatedAt,

  provider: serializeProvider(provider, vacancy),
});

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
// GET ALL
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
// GET ONE
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

      data: toVacancyDetails(
        vacancy,

        provider,
      ),
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

    const actor = getAdminActor(req);

    const now = new Date();

    const fromStatus = vacancy.status;

    vacancy.status = "approved";

    vacancy.isPublished = false;

    vacancy.reviewedAt = now;

    vacancy.reviewedByType = "admin";

    vacancy.reviewedById = actor.id;

    vacancy.reviewedByName = actor.name;

    vacancy.rejectionReason = null;

    vacancy.publishedAt = null;

    vacancy.publishedByAdminId = null;

    vacancy.publishedByAdminName = null;

    vacancy.closedAt = null;

    vacancy.closedByAdminId = null;

    vacancy.closedByAdminName = null;

    addWorkflowHistory(vacancy, {
      action: "APPROVED",

      fromStatus,

      toStatus: "approved",

      actor,
    });

    await vacancy.save();

    return res.status(200).json({
      success: true,

      message: "Vacancy approved successfully.",

      data: {
        vacancyId: vacancy.vacancyId,

        status: vacancy.status,

        isPublished: vacancy.isPublished,

        review: serializeReview(vacancy),
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

    const actor = getAdminActor(req);

    const now = new Date();

    const fromStatus = vacancy.status;

    vacancy.status = "rejected";

    vacancy.isPublished = false;

    vacancy.reviewedAt = now;

    vacancy.reviewedByType = "admin";

    vacancy.reviewedById = actor.id;

    vacancy.reviewedByName = actor.name;

    vacancy.rejectionReason = reason;

    vacancy.publishedAt = null;

    vacancy.publishedByAdminId = null;

    vacancy.publishedByAdminName = null;

    vacancy.closedAt = null;

    vacancy.closedByAdminId = null;

    vacancy.closedByAdminName = null;

    addWorkflowHistory(vacancy, {
      action: "REJECTED",

      fromStatus,

      toStatus: "rejected",

      actor,

      reason,
    });

    await vacancy.save();

    return res.status(200).json({
      success: true,

      message: "Vacancy rejected.",

      data: {
        vacancyId: vacancy.vacancyId,

        status: vacancy.status,

        isPublished: vacancy.isPublished,

        review: serializeReview(vacancy),
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

    const actor = getAdminActor(req);

    const now = new Date();

    const fromStatus = vacancy.status;

    vacancy.status = "published";

    vacancy.isPublished = true;

    vacancy.rejectionReason = null;

    vacancy.publishedAt = now;

    vacancy.publishedByAdminId = actor.id;

    vacancy.publishedByAdminName = actor.name;

    vacancy.closedAt = null;

    vacancy.closedByAdminId = null;

    vacancy.closedByAdminName = null;

    addWorkflowHistory(vacancy, {
      action: "PUBLISHED",

      fromStatus,

      toStatus: "published",

      actor,
    });

    await vacancy.save();

    return res.status(200).json({
      success: true,

      message: "Vacancy published successfully.",

      data: {
        vacancyId: vacancy.vacancyId,

        status: vacancy.status,

        isPublished: vacancy.isPublished,

        publication: serializePublication(vacancy),
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

    const actor = getAdminActor(req);

    const now = new Date();

    const fromStatus = vacancy.status;

    vacancy.status = "closed";

    vacancy.isPublished = false;

    vacancy.closedAt = now;

    vacancy.closedByAdminId = actor.id;

    vacancy.closedByAdminName = actor.name;

    addWorkflowHistory(vacancy, {
      action: "CLOSED",

      fromStatus,

      toStatus: "closed",

      actor,
    });

    await vacancy.save();

    return res.status(200).json({
      success: true,

      message: "Vacancy closed successfully.",

      data: {
        vacancyId: vacancy.vacancyId,

        status: vacancy.status,

        isPublished: vacancy.isPublished,

        closing: serializeClosing(vacancy),
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
