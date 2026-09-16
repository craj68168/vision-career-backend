const Vacancy = require(
  "../../models/providers/vacancySchema",
);

const Application = require(
  "../../models/applications/applicationSchema",
);

// ======================================================
// GET SEEKER DASHBOARD SUMMARY
// GET /api/seekers/dashboard/summary
// ======================================================

exports.getDashboardSummary = async (req, res) => {
  try {
    const seekerId = req.user.seeker_id;

    const appliedVacancyIds =
      await Application.distinct(
        "vacancy_id",
        {
          seeker_id: seekerId,
        },
      );

    const availableJobs =
      await Vacancy.countDocuments({
        status: "published",
        isPublished: true,

        vacancyId: {
          $nin: appliedVacancyIds,
        },
      });

    const appliedJobs =
      await Application.countDocuments({
        seeker_id: seekerId,
      });

    const inProgress =
      await Application.countDocuments({
        seeker_id: seekerId,

        status: {
          $in: [
            "PENDING_ADMIN_APPROVAL",
            "SENT_TO_PROVIDER",
            "UNDER_REVIEW",
            "INTERVIEW",
            "SELECTED",
          ],
        },
      });

    return res.status(200).json({
      success: true,

      data: {
        availableJobs,
        appliedJobs,
        inProgress,
      },
    });
  } catch (error) {
    console.error(
      "Get dashboard summary error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to get dashboard summary.",
    });
  }
};