const Interview = require("../../models/interviews/interviewSchema");

const Application = require("../../models/applications/applicationSchema");

const Vacancy = require("../../models/providers/vacancySchema");

const PlacementCandidate = require("../../models/placements/placementCandidateSchema");

const Recruit = require("../../models/providers/recruitSchema");

const Provider = require("../../models/providers/registerSchema");

const SEEKER_VISIBLE_STATUSES = ["CONFIRMED", "COMPLETED", "CANCELLED"];

const normalizeString = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const getSourceType = (interview) =>
  interview.source_type ||
  (interview.placement_candidate_id ? "PLACEMENT" : "APPLICATION");

const toDisplayJob = ({ vacancy, recruit, provider }) => ({
  vacancyId: vacancy?.vacancyId || null,

  recruitId: recruit?.recruitId || null,

  companyName: vacancy?.companyName || provider?.companyName || null,

  companyNameKana: vacancy?.companyNameKana || null,

  title: vacancy?.title || recruit?.job_title || null,

  titleKana: vacancy?.titleKana || null,

  employmentType: vacancy?.employmentType || recruit?.employment_type || null,

  workLocation: vacancy?.workLocation || recruit?.work_location || null,

  remoteWork: vacancy?.remoteWork || null,
});

const loadContext = async ({ interview, seekerId }) => {
  const sourceType = getSourceType(interview);

  const provider = await Provider.findOne({
    registerId: interview.provider_id,
  }).lean();

  if (sourceType === "PLACEMENT") {
    const [placementCandidate, recruit] = await Promise.all([
      PlacementCandidate.findOne({
        placementCandidateId: interview.placement_candidate_id,

        seekerId,
      }).lean(),

      Recruit.findOne({
        recruitId: interview.recruit_id,
      }).lean(),
    ]);

    return {
      sourceType,
      application: null,
      vacancy: null,
      placementCandidate,
      recruit,
      provider,
    };
  }

  const [application, vacancy] = await Promise.all([
    Application.findOne({
      application_id: interview.application_id,

      seeker_id: seekerId,
    }).lean(),

    Vacancy.findOne({
      vacancyId: interview.vacancy_id,
    }).lean(),
  ]);

  return {
    sourceType,
    application,
    vacancy,
    placementCandidate: null,
    recruit: null,
    provider,
  };
};

const toSeekerInterview = ({
  interview,
  application,
  vacancy,
  placementCandidate,
  recruit,
  provider,
}) => {
  const data = interview?.toObject ? interview.toObject() : interview;

  const sourceType = getSourceType(data);

  const isCancelled = data.status === "CANCELLED";

  const job = toDisplayJob({
    vacancy,
    recruit,
    provider,
  });

  return {
    interviewId: data.interview_id,

    sourceType,

    applicationId: data.application_id || null,

    vacancyId: data.vacancy_id || null,

    placementCandidateId: data.placement_candidate_id || null,

    recruitId: data.recruit_id || null,

    applicationStatus: application?.status || null,

    placementCandidateStatus: placementCandidate?.status || null,

    interviewDate: data.interview_date,

    interviewTime: data.interview_time,

    timezone: data.timezone,

    interviewMethod: data.interview_method,

    meetingLink: isCancelled ? null : data.meeting_link || null,

    notes: data.notes || null,

    status: data.status,

    confirmedAt: data.confirmed_at || null,

    completedAt: data.completed_at || null,

    cancelledAt: data.cancelled_at || null,

    cancellationReason: data.cancellation_reason || null,

    createdAt: data.created_at,

    updatedAt: data.updated_at,

    // Keep "vacancy" for current frontend compatibility.
    vacancy: job,

    placementRequest:
      sourceType === "PLACEMENT"
        ? {
            recruitId: recruit?.recruitId || null,

            title: recruit?.job_title || null,

            companyName: provider?.companyName || null,

            employmentType: recruit?.employment_type || null,

            workLocation: recruit?.work_location || null,
          }
        : null,
  };
};

// ======================================================
// GET MY INTERVIEWS
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

    if (requestedStatus) {
      if (!SEEKER_VISIBLE_STATUSES.includes(requestedStatus)) {
        return res.status(400).json({
          success: false,

          message: "Invalid interview status.",
        });
      }

      query.status = requestedStatus;
    }

    const interviews = await Interview.find(query)
      .sort({
        interview_date: 1,
        interview_time: 1,
        created_at: -1,
      })
      .lean();

    const data = [];

    for (const interview of interviews) {
      const context = await loadContext({
        interview,
        seekerId,
      });

      data.push(
        toSeekerInterview({
          interview,
          ...context,
        }),
      );
    }

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
// GET ONE
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

    const context = await loadContext({
      interview,
      seekerId,
    });

    return res.status(200).json({
      success: true,

      data: toSeekerInterview({
        interview,
        ...context,
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
