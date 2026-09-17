const Seeker = require("../../models/seekers/seekerSchema");
const Provider = require("../../models/providers/registerSchema");
const Vacancy = require("../../models/providers/vacancySchema");
const Application = require("../../models/applications/applicationSchema");
const Recruit = require("../../models/providers/recruitSchema");

// ======================================================
// STAFF DASHBOARD
//
// GET /api/staff/dashboard
// ======================================================

exports.getStaffDashboard = async (req, res) => {
  try {
    const [
      totalSeekers,
      totalProviders,
      totalVacancies,
      publishedVacancies,
      pendingVacancies,
      totalApplications,
      pendingApplications,
      providerProcess,
      placementRequests,
    ] = await Promise.all([
      Seeker.countDocuments(),

      Provider.countDocuments({
        role: "provider",
      }),

      Vacancy.countDocuments(),

      Vacancy.countDocuments({
        status: "published",
        isPublished: true,
      }),

      Vacancy.countDocuments({
        status: "pending_review",
      }),

      Application.countDocuments(),

      Application.countDocuments({
        status: "PENDING_ADMIN_APPROVAL",
      }),

      Application.countDocuments({
        status: {
          $in: ["SENT_TO_PROVIDER", "UNDER_REVIEW", "INTERVIEW", "SELECTED"],
        },
      }),

      Recruit.countDocuments({
        status: {
          $ne: "draft",
        },
      }),
    ]);

    return res.status(200).json({
      success: true,

      data: {
        summary: {
          jobSeekers: {
            total: totalSeekers,
          },

          providers: {
            total: totalProviders,
          },

          vacancies: {
            total: totalVacancies,
            published: publishedVacancies,
            pendingReview: pendingVacancies,
          },

          applications: {
            total: totalApplications,
            pendingAdminApproval: pendingApplications,
            providerProcess,
          },

          placementRequests: {
            total: placementRequests,
          },
        },
      },
    });
  } catch (error) {
    console.error("STAFF DASHBOARD ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load Staff dashboard.",
    });
  }
};
