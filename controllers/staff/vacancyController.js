const Vacancy = require("../../models/providers/vacancySchema");

const Provider = require("../../models/providers/registerSchema");

// ======================================================
// STAFF ACTOR
// ======================================================

const getStaffActor = (req) => ({
  type: "staff",

  id:
    req.staff?.staffId || req.staff?.id || req.staff?._id?.toString?.() || null,

  name: req.staff?.name || req.staff?.fullName || req.staff?.email || "Staff",
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
// SCREENING SERIALIZER
// ======================================================

const serializeScreening = (vacancy) => ({
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
// HISTORY
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
// PROVIDER DETAILS
//
// Authorized Staff can see internal provider information.
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
// VACANCY SERIALIZER
// ======================================================

const serializeVacancy = (vacancy, provider = null) => ({
  vacancyId: vacancy.vacancyId,

  providerId: vacancy.registerId,

  companyName: vacancy.companyName,

  companyNameKana: vacancy.companyNameKana || null,

  title: vacancy.title,

  titleKana: vacancy.titleKana || null,

  employmentType: vacancy.employmentType,

  numberOfPeople: vacancy.numberOfPeople,

  jobDescription: vacancy.jobDescription,

  responsibilities: vacancy.responsibilities || null,

  requiredSkills: vacancy.requiredSkills || null,

  preferredSkills: vacancy.preferredSkills || null,

  requiredEducation: vacancy.requiredEducation || null,

  requiredExperience: vacancy.requiredExperience || null,

  japaneseLevel: vacancy.japaneseLevel || null,

  // ====================================================
  // ORIGINAL INTERNAL LOCATION
  // ====================================================

  workLocation: vacancy.workLocation,

  workLocationDetail: vacancy.workLocationDetail || null,

  remoteWork: vacancy.remoteWork || null,

  salaryMin: vacancy.salaryMin ?? null,

  salaryMax: vacancy.salaryMax ?? null,

  salaryNote: vacancy.salaryNote || null,

  workHours: vacancy.workHours || null,

  breakTime: vacancy.breakTime || null,

  overtime: vacancy.overtime || null,

  holidays: vacancy.holidays || null,

  benefits: vacancy.benefits || [],

  insurance: vacancy.insurance || [],

  trialPeriod: vacancy.trialPeriod || null,

  applicationDeadline: vacancy.applicationDeadline || null,

  startDate: vacancy.startDate || null,

  selectionProcess: vacancy.selectionProcess || null,

  // ====================================================
  // PRIVATE INTERNAL CONTACT
  // ====================================================

  contactPerson: vacancy.contactPerson || null,

  contactPersonKana: vacancy.contactPersonKana || null,

  contactEmail: vacancy.contactEmail || null,

  // ====================================================
  // WORKFLOW
  // ====================================================

  status: vacancy.status,

  isPublished: vacancy.isPublished,

  review: serializeReview(vacancy),

  publication: {
    publishedAt: vacancy.publishedAt || null,

    publishedByAdminId: vacancy.publishedByAdminId || null,

    publishedByAdminName: vacancy.publishedByAdminName || null,
  },

  closing: {
    closedAt: vacancy.closedAt || null,

    closedByAdminId: vacancy.closedByAdminId || null,

    closedByAdminName: vacancy.closedByAdminName || null,
  },

  staffScreening: serializeScreening(vacancy),

  workflowHistory: serializeWorkflowHistory(vacancy),

  provider: serializeProvider(provider, vacancy),

  createdAt: vacancy.createdAt,

  updatedAt: vacancy.updatedAt,
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
// GET STAFF VACANCIES
// ======================================================

exports.getStaffVacancies = async (req, res) => {
  try {
    const vacancies = await Vacancy.find()
      .sort({
        createdAt: -1,
      })
      .lean();

    const providerMap = await getProviderMap(vacancies);

    const data = vacancies.map((vacancy) =>
      serializeVacancy(
        vacancy,

        providerMap.get(vacancy.registerId),
      ),
    );

    return res.status(200).json({
      success: true,

      count: data.length,

      summary: {
        total: data.length,

        pendingReview: data.filter((item) => item.status === "pending_review")
          .length,

        notScreened: data.filter(
          (item) =>
            item.status === "pending_review" &&
            item.staffScreening.status === "NOT_SCREENED",
        ).length,

        screened: data.filter(
          (item) => item.staffScreening.status === "SCREENED",
        ).length,

        needsAttention: data.filter(
          (item) => item.staffScreening.status === "NEEDS_ATTENTION",
        ).length,

        published: data.filter(
          (item) => item.status === "published" && item.isPublished,
        ).length,
      },

      data,
    });
  } catch (error) {
    console.error("GET STAFF VACANCIES ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load vacancies.",
    });
  }
};

// ======================================================
// GET ONE
// ======================================================

exports.getStaffVacancyById = async (req, res) => {
  try {
    const vacancy = await Vacancy.findOne({
      vacancyId: req.params.vacancyId,
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

      data: serializeVacancy(
        vacancy,

        provider,
      ),
    });
  } catch (error) {
    console.error("GET STAFF VACANCY ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load vacancy.",
    });
  }
};

// ======================================================
// SCREEN VACANCY
//
// Permission:
// vacancies:review
// ======================================================

exports.screenVacancy = async (req, res) => {
  try {
    const { screeningStatus, note } = req.body;

    if (!["SCREENED", "NEEDS_ATTENTION"].includes(screeningStatus)) {
      return res.status(400).json({
        success: false,

        message: "Invalid screening status.",
      });
    }

    const normalizedNote = String(note || "").trim();

    if (screeningStatus === "NEEDS_ATTENTION" && !normalizedNote) {
      return res.status(400).json({
        success: false,

        message:
          "A note is required when marking a vacancy as needing attention.",
      });
    }

    if (normalizedNote.length > 2000) {
      return res.status(400).json({
        success: false,

        message: "Screening note cannot exceed 2000 characters.",
      });
    }

    const vacancy = await Vacancy.findOne({
      vacancyId: req.params.vacancyId,
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

        message: "Only vacancies waiting for review can be screened.",
      });
    }

    const actor = getStaffActor(req);

    vacancy.staff_screening_status = screeningStatus;

    vacancy.staff_screening_note = normalizedNote || null;

    vacancy.screened_by_staff_id = actor.id;

    vacancy.screened_by_staff_name = actor.name;

    vacancy.screened_at = new Date();

    addWorkflowHistory(vacancy, {
      action: screeningStatus === "SCREENED" ? "SCREENED" : "NEEDS_ATTENTION",

      fromStatus: vacancy.status,

      toStatus: vacancy.status,

      actor,

      note: normalizedNote || null,
    });

    await vacancy.save();

    const provider = await Provider.findOne({
      registerId: vacancy.registerId,
    }).lean();

    return res.status(200).json({
      success: true,

      message:
        screeningStatus === "SCREENED"
          ? "Vacancy screening completed."
          : "Vacancy marked as needing attention.",

      data: serializeVacancy(
        vacancy,

        provider,
      ),
    });
  } catch (error) {
    console.error("SCREEN STAFF VACANCY ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to screen vacancy.",
    });
  }
};

// ======================================================
// APPROVE
//
// vacancies:approval
//
// pending_review -> approved
//
// Staff approval does NOT publish.
// ======================================================

exports.approveStaffVacancy = async (req, res) => {
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

    const actor = getStaffActor(req);

    const fromStatus = vacancy.status;

    vacancy.status = "approved";

    vacancy.isPublished = false;

    vacancy.reviewedAt = new Date();

    vacancy.reviewedByType = "staff";

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

    const provider = await Provider.findOne({
      registerId: vacancy.registerId,
    }).lean();

    return res.status(200).json({
      success: true,

      message: "Vacancy approved successfully.",

      data: serializeVacancy(
        vacancy,

        provider,
      ),
    });
  } catch (error) {
    console.error("APPROVE STAFF VACANCY ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to approve vacancy.",
    });
  }
};

// ======================================================
// REJECT
//
// vacancies:approval
//
// pending_review -> rejected
// ======================================================

exports.rejectStaffVacancy = async (req, res) => {
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

    const actor = getStaffActor(req);

    const fromStatus = vacancy.status;

    vacancy.status = "rejected";

    vacancy.isPublished = false;

    vacancy.reviewedAt = new Date();

    vacancy.reviewedByType = "staff";

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

    const provider = await Provider.findOne({
      registerId: vacancy.registerId,
    }).lean();

    return res.status(200).json({
      success: true,

      message: "Vacancy rejected.",

      data: serializeVacancy(
        vacancy,

        provider,
      ),
    });
  } catch (error) {
    console.error("REJECT STAFF VACANCY ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to reject vacancy.",
    });
  }
};
