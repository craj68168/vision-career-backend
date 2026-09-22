const Vacancy = require("../../models/providers/vacancySchema");

// ======================================================
// STAFF SCREENING SERIALIZER
// ======================================================

const serializeScreening = (vacancy) => ({
  status: vacancy.staff_screening_status || "NOT_SCREENED",

  note: vacancy.staff_screening_note || null,

  screenedByStaffId: vacancy.screened_by_staff_id || null,

  screenedAt: vacancy.screened_at || null,
});

// ======================================================
// VACANCY SERIALIZER
//
// Staff receives business information required for
// screening.
//
// Provider private contact fields are intentionally not
// included here.
// ======================================================

const serializeVacancy = (vacancy) => ({
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

  status: vacancy.status,

  isPublished: vacancy.isPublished,

  reviewedAt: vacancy.reviewedAt || null,

  rejectionReason: vacancy.rejectionReason || null,

  staffScreening: serializeScreening(vacancy),

  createdAt: vacancy.createdAt,

  updatedAt: vacancy.updatedAt,
});

// ======================================================
// GET STAFF VACANCIES
//
// GET /api/staff/vacancies
// ======================================================

exports.getStaffVacancies = async (req, res) => {
  try {
    const vacancies = await Vacancy.find()
      .sort({
        createdAt: -1,
      })
      .lean();

    const data = vacancies.map(serializeVacancy);

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
// GET ONE STAFF VACANCY
//
// GET /api/staff/vacancies/:vacancyId
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

    return res.status(200).json({
      success: true,

      data: serializeVacancy(vacancy),
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
// PATCH /api/staff/vacancies/:vacancyId/screen
//
// Staff DOES NOT:
// - approve
// - reject
// - publish
// - close
//
// Staff only adds screening information.
// ======================================================

exports.screenVacancy = async (req, res) => {
  try {
    const { screeningStatus, note } = req.body;

    // ==================================================
    // SCREENING STATUS
    // ==================================================

    if (!["SCREENED", "NEEDS_ATTENTION"].includes(screeningStatus)) {
      return res.status(400).json({
        success: false,

        message: "Invalid screening status.",
      });
    }

    const normalizedNote = String(note || "").trim();

    // ==================================================
    // NEEDS ATTENTION REQUIRES NOTE
    // ==================================================

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

    // ==================================================
    // FIND VACANCY
    // ==================================================

    const vacancy = await Vacancy.findOne({
      vacancyId: req.params.vacancyId,
    });

    if (!vacancy) {
      return res.status(404).json({
        success: false,

        message: "Vacancy not found.",
      });
    }

    // ==================================================
    // ONLY PENDING REVIEW VACANCIES CAN BE SCREENED
    // ==================================================

    if (vacancy.status !== "pending_review") {
      return res.status(409).json({
        success: false,

        message: "Only vacancies waiting for Admin review can be screened.",
      });
    }

    // ==================================================
    // SAVE SCREENING
    // ==================================================

    vacancy.staff_screening_status = screeningStatus;

    vacancy.staff_screening_note = normalizedNote || null;

    vacancy.screened_by_staff_id = req.staff.staffId;

    vacancy.screened_at = new Date();

    await vacancy.save();

    return res.status(200).json({
      success: true,

      message:
        screeningStatus === "SCREENED"
          ? "Vacancy screening completed."
          : "Vacancy marked as needing Admin attention.",

      data: serializeVacancy(vacancy),
    });
  } catch (error) {
    console.error("SCREEN STAFF VACANCY ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to screen vacancy.",
    });
  }
};
