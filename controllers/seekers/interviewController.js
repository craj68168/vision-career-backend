const Interview = require("../../models/interviews/interviewSchema");

const Application = require("../../models/applications/applicationSchema");

const Vacancy = require("../../models/providers/vacancySchema");

// ======================================================
// SEEKER VISIBLE INTERVIEW STATUSES
// ======================================================
//
// IMPORTANT:
//
// AWAITING_LINK is intentionally hidden from the Seeker.
//
// For Zoom / Google Meet interviews, the candidate should
// receive the final interview information only after the
// meeting link is ready.
//
// ======================================================

const SEEKER_VISIBLE_STATUSES = ["CONFIRMED", "COMPLETED", "CANCELLED"];

// ======================================================
// NORMALIZE STRING
// ======================================================

const normalizeString = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

// ======================================================
// SEEKER-SAFE VACANCY SUMMARY
// ======================================================
//
// Do NOT expose:
//
// registerId
// contactPerson
// contactEmail
// workLocationDetail
//
// ======================================================

const toSeekerVacancySummary = (vacancy) => {
  if (!vacancy) {
    return null;
  }

  return {
    vacancyId: vacancy.vacancyId,

    companyName: vacancy.companyName,

    companyNameKana: vacancy.companyNameKana || null,

    title: vacancy.title,

    titleKana: vacancy.titleKana || null,

    employmentType: vacancy.employmentType || null,

    workLocation: vacancy.workLocation || null,

    remoteWork: vacancy.remoteWork || null,
  };
};

// ======================================================
// SEEKER INTERVIEW SERIALIZER
// ======================================================

const toSeekerInterview = ({ interview, application, vacancy }) => {
  const data = interview?.toObject ? interview.toObject() : interview;

  const isCancelled = data.status === "CANCELLED";

  return {
    interviewId: data.interview_id,

    applicationId: data.application_id,

    vacancyId: data.vacancy_id,

    applicationStatus: application?.status || null,

    interviewDate: data.interview_date,

    interviewTime: data.interview_time,

    timezone: data.timezone,

    interviewMethod: data.interview_method,

    // Do not expose an old meeting link after cancellation.

    meetingLink: isCancelled ? null : data.meeting_link || null,

    notes: data.notes || null,

    status: data.status,

    confirmedAt: data.confirmed_at || null,

    completedAt: data.completed_at || null,

    cancelledAt: data.cancelled_at || null,

    cancellationReason: data.cancellation_reason || null,

    createdAt: data.created_at,

    updatedAt: data.updated_at,

    vacancy: toSeekerVacancySummary(vacancy),
  };
};

// ======================================================
// LOAD RELATED DATA
// ======================================================

const loadRelatedData = async ({ interviews, seekerId }) => {
  const applicationIds = [
    ...new Set(
      interviews.map((interview) => interview.application_id).filter(Boolean),
    ),
  ];

  const vacancyIds = [
    ...new Set(
      interviews.map((interview) => interview.vacancy_id).filter(Boolean),
    ),
  ];

  const [applications, vacancies] = await Promise.all([
    applicationIds.length
      ? Application.find({
          application_id: {
            $in: applicationIds,
          },

          seeker_id: seekerId,
        }).lean()
      : [],

    vacancyIds.length
      ? Vacancy.find({
          vacancyId: {
            $in: vacancyIds,
          },
        }).lean()
      : [],
  ]);

  return {
    applicationMap: new Map(
      applications.map((application) => [
        application.application_id,
        application,
      ]),
    ),

    vacancyMap: new Map(
      vacancies.map((vacancy) => [vacancy.vacancyId, vacancy]),
    ),
  };
};

// ======================================================
// GET MY INTERVIEWS
//
// GET
// /api/seekers/interviews
//
// Optional:
//
// ?status=CONFIRMED
//
// ======================================================

exports.getMyInterviews = async (req, res) => {
  try {
    const seekerId = req.user?.seeker_id;

    if (!seekerId) {
      return res.status(401).json({
        success: false,

        message: "Seeker authentication required.",
      });
    }

    const requestedStatus = normalizeString(req.query.status).toUpperCase();

    const query = {
      seeker_id: seekerId,

      status: {
        $in: SEEKER_VISIBLE_STATUSES,
      },
    };

    // ==================================================
    // OPTIONAL STATUS FILTER
    // ==================================================

    if (requestedStatus) {
      if (!SEEKER_VISIBLE_STATUSES.includes(requestedStatus)) {
        return res.status(400).json({
          success: false,

          message: "Invalid interview status.",
        });
      }

      query.status = requestedStatus;
    }

    // ==================================================
    // LOAD INTERVIEWS
    // ==================================================

    const interviews = await Interview.find(query)
      .sort({
        interview_date: 1,
        interview_time: 1,
        created_at: -1,
      })
      .lean();

    const { applicationMap, vacancyMap } = await loadRelatedData({
      interviews,
      seekerId,
    });

    const data = interviews.map((interview) =>
      toSeekerInterview({
        interview,

        application: applicationMap.get(interview.application_id),

        vacancy: vacancyMap.get(interview.vacancy_id),
      }),
    );

    // ==================================================
    // SUMMARY
    // ==================================================

    const [confirmed, completed, cancelled] = await Promise.all([
      Interview.countDocuments({
        seeker_id: seekerId,

        status: "CONFIRMED",
      }),

      Interview.countDocuments({
        seeker_id: seekerId,

        status: "COMPLETED",
      }),

      Interview.countDocuments({
        seeker_id: seekerId,

        status: "CANCELLED",
      }),
    ]);

    return res.status(200).json({
      success: true,

      count: data.length,

      summary: {
        confirmed,

        completed,

        cancelled,
      },

      data,
    });
  } catch (error) {
    console.error("GET SEEKER INTERVIEWS ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load interviews.",
    });
  }
};

// ======================================================
// GET MY INTERVIEW BY ID
//
// GET
// /api/seekers/interviews/:interviewId
//
// ======================================================

exports.getMyInterviewById = async (req, res) => {
  try {
    const seekerId = req.user?.seeker_id;

    const { interviewId } = req.params;

    if (!seekerId) {
      return res.status(401).json({
        success: false,

        message: "Seeker authentication required.",
      });
    }

    // ==================================================
    // INTERVIEW MUST BELONG TO LOGGED-IN SEEKER
    // ==================================================

    const interview = await Interview.findOne({
      interview_id: interviewId,

      seeker_id: seekerId,

      status: {
        $in: SEEKER_VISIBLE_STATUSES,
      },
    });

    if (!interview) {
      return res.status(404).json({
        success: false,

        message: "Interview not found.",
      });
    }

    // ==================================================
    // RELATED APPLICATION
    // ==================================================

    const application = await Application.findOne({
      application_id: interview.application_id,

      seeker_id: seekerId,
    });

    if (!application) {
      return res.status(404).json({
        success: false,

        message: "Related application not found.",
      });
    }

    // ==================================================
    // RELATED VACANCY
    // ==================================================

    const vacancy = await Vacancy.findOne({
      vacancyId: interview.vacancy_id,
    });

    // ==================================================
    // RESPONSE
    // ==================================================

    return res.status(200).json({
      success: true,

      data: toSeekerInterview({
        interview,
        application,
        vacancy,
      }),
    });
  } catch (error) {
    console.error("GET SEEKER INTERVIEW ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load interview.",
    });
  }
};
