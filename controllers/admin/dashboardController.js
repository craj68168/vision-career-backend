const Seeker = require("../../models/seekers/seekerSchema");
const Provider = require("../../models/providers/registerSchema");
const Vacancy = require("../../models/providers/vacancySchema");
const Application = require("../../models/applications/applicationSchema");
const Recruit = require("../../models/providers/recruitSchema");

// ======================================================
// GET ADMIN DASHBOARD
//
// GET /api/admin/dashboard
// ======================================================

exports.getAdminDashboard = async (req, res) => {
  try {
    // ==================================================
    // SUMMARY COUNTS
    // ==================================================

    const [
      totalJobSeekers,
      totalProviders,
      totalVacancies,
      publishedVacancies,
      pendingVacancies,
      totalApplications,
      pendingApplications,
      sentToProviderApplications,
      underReviewApplications,
      interviewApplications,
      selectedApplications,
      hiredApplications,
      totalPlacementRequests,
    ] = await Promise.all([
      Seeker.countDocuments(),
      Provider.countDocuments(),
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
        status: "SENT_TO_PROVIDER",
      }),
      Application.countDocuments({
        status: "UNDER_REVIEW",
      }),
      Application.countDocuments({
        status: "INTERVIEW",
      }),
      Application.countDocuments({
        status: "SELECTED",
      }),
      Application.countDocuments({
        status: "HIRED",
      }),
      Recruit.countDocuments(),
    ]);

    // ==================================================
    // RECENT PENDING APPLICATIONS
    // ==================================================

    const pendingApplicationDocuments = await Application.find({
      status: "PENDING_ADMIN_APPROVAL",
    })
      .sort({
        applied_at: -1,
      })
      .limit(5)
      .lean();

    // ==================================================
    // FIND VACANCIES FOR THOSE APPLICATIONS
    // ==================================================

    const vacancyIds = [
      ...new Set(
        pendingApplicationDocuments
          .map((application) => application.vacancy_id)
          .filter(Boolean),
      ),
    ];

    const applicationVacancies =
      vacancyIds.length > 0
        ? await Vacancy.find({
            vacancyId: {
              $in: vacancyIds,
            },
          })
            .select("vacancyId title companyName employmentType workLocation")
            .lean()
        : [];

    const vacancyMap = new Map(
      applicationVacancies.map((vacancy) => [vacancy.vacancyId, vacancy]),
    );

    const recentPendingApplications = pendingApplicationDocuments.map(
      (application) => {
        const vacancy = vacancyMap.get(application.vacancy_id);

        return {
          applicationId: application.application_id,

          seekerId: application.seeker_id,

          vacancyId: application.vacancy_id,

          providerId: application.provider_id,

          candidateName: application.profile_snapshot?.name || "Unknown",

          vacancyTitle: vacancy?.title || "Unknown Vacancy",

          companyName: vacancy?.companyName || "Unknown Company",

          employmentType: vacancy?.employmentType || null,

          workLocation: vacancy?.workLocation || null,

          status: application.status,

          appliedAt: application.applied_at,
        };
      },
    );

    // ==================================================
    // RECENT VACANCIES
    // ==================================================

    const recentVacancyDocuments = await Vacancy.find()
      .sort({
        createdAt: -1,
      })
      .limit(5)
      .select(
        [
          "vacancyId",
          "companyName",
          "title",
          "employmentType",
          "numberOfPeople",
          "workLocation",
          "status",
          "isPublished",
          "createdAt",
        ].join(" "),
      )
      .lean();

    const recentVacancies = recentVacancyDocuments.map((vacancy) => ({
      vacancyId: vacancy.vacancyId,

      companyName: vacancy.companyName,

      title: vacancy.title,

      employmentType: vacancy.employmentType,

      numberOfPeople: vacancy.numberOfPeople,

      workLocation: vacancy.workLocation,

      status: vacancy.status,

      isPublished: vacancy.isPublished,

      createdAt: vacancy.createdAt,
    }));

    // ==================================================
    // RESPONSE
    // ==================================================

    return res.status(200).json({
      success: true,

      data: {
        summary: {
          jobSeekers: {
            total: totalJobSeekers,
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

            sentToProvider: sentToProviderApplications,

            underReview: underReviewApplications,

            interview: interviewApplications,

            selected: selectedApplications,

            hired: hiredApplications,
          },

          placementRequests: {
            total: totalPlacementRequests,
          },
        },

        recent: {
          pendingApplications: recentPendingApplications,

          vacancies: recentVacancies,
        },
      },
    });
  } catch (error) {
    console.error("GET ADMIN DASHBOARD ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load Admin dashboard.",
    });
  }
};
