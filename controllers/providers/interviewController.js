const crypto = require("crypto");

const Interview = require("../../models/interviews/interviewSchema");

const Application = require("../../models/applications/applicationSchema");

const Vacancy = require("../../models/providers/vacancySchema");

const PlacementCandidate = require("../../models/placements/placementCandidateSchema");

const Recruit = require("../../models/providers/recruitSchema");

const Provider = require("../../models/providers/registerSchema");

const {
  notifySeekerAboutInterview,
} = require("../../services/interviewNotificationService");

// ======================================================
// CONSTANTS
// ======================================================

const INTERVIEW_METHODS = [
  "ZOOM",
  "GOOGLE_MEET",
  "PHONE",
  "FACE_TO_FACE",
  "OTHER",
];

const PROVIDER_VISIBLE_INTERVIEW_STATUSES = [
  "AWAITING_LINK",
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
];

const INTERVIEW_ELIGIBLE_APPLICATION_STATUSES = [
  "SENT_TO_PROVIDER",
  "UNDER_REVIEW",
];

const ONLINE_INTERVIEW_METHODS = ["ZOOM", "GOOGLE_MEET"];

// ======================================================
// HELPERS
// ======================================================

const generateInterviewId = () =>
  `INT-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

const normalizeString = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const isValidInterviewTime = (value) => {
  if (typeof value !== "string") {
    return false;
  }

  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value.trim());
};

const parseInterviewDate = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const determineInterviewStatus = ({ interviewMethod, meetingLink }) => {
  if (ONLINE_INTERVIEW_METHODS.includes(interviewMethod) && !meetingLink) {
    return "AWAITING_LINK";
  }

  return "CONFIRMED";
};

const getSourceType = (interview) =>
  interview.source_type ||
  (interview.placement_candidate_id ? "PLACEMENT" : "APPLICATION");

// ======================================================
// SERIALIZERS
// ======================================================

const toApplicationCandidateSummary = (application) => ({
  name: application?.profile_snapshot?.name || null,

  nationality: application?.profile_snapshot?.nationality || null,

  visaType: application?.profile_snapshot?.visa_type || null,

  visaExpiryDate: application?.profile_snapshot?.visa_expiry_date || null,

  japaneseLevel: application?.profile_snapshot?.japanese_level || null,

  skills: application?.profile_snapshot?.skills || [],

  desiredJob: application?.profile_snapshot?.desired_job || null,

  desiredLocation: application?.profile_snapshot?.desired_location || null,
});

const toPlacementCandidateSummary = (candidate) => {
  const snapshot = candidate?.candidate_snapshot;

  return {
    name: snapshot?.name || null,

    nationality: snapshot?.nationality || null,

    visaType: snapshot?.visa_type || null,

    visaExpiryDate: snapshot?.visa_expiry_date || null,

    japaneseLevel: snapshot?.japanese_level || null,

    skills: snapshot?.skills || [],

    desiredJob: snapshot?.desired_job || null,

    desiredLocation: snapshot?.desired_location || null,
  };
};

const toVacancySummary = (vacancy) => {
  if (!vacancy) {
    return null;
  }

  return {
    vacancyId: vacancy.vacancyId,

    title: vacancy.title,

    companyName: vacancy.companyName,

    employmentType: vacancy.employmentType,

    workLocation: vacancy.workLocation,

    japaneseLevel: vacancy.japaneseLevel,
  };
};

const toPlacementSummary = ({ recruit, provider }) => {
  if (!recruit) {
    return null;
  }

  return {
    recruitId: recruit.recruitId,

    title: recruit.job_title || null,

    companyName: provider?.companyName || null,

    employmentType: recruit.employment_type || null,

    workLocation: recruit.work_location || null,

    japaneseLevel: recruit.japanese_level_required || null,
  };
};

const toProviderInterview = ({
  interview,
  application = null,
  vacancy = null,
  placementCandidate = null,
  recruit = null,
  provider = null,
}) => {
  const data = interview?.toObject ? interview.toObject() : interview;

  const sourceType = getSourceType(data);

  const candidate =
    sourceType === "PLACEMENT"
      ? toPlacementCandidateSummary(placementCandidate)
      : toApplicationCandidateSummary(application);

  const placementRequest = toPlacementSummary({
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

    meetingLink: data.meeting_link || null,

    notes: data.notes || null,

    status: data.status,

    confirmedAt: data.confirmed_at || null,

    completedAt: data.completed_at || null,

    cancelledAt: data.cancelled_at || null,

    cancellationReason: data.cancellation_reason || null,

    createdAt: data.created_at,

    updatedAt: data.updated_at,

    candidate,

    vacancy: toVacancySummary(vacancy),

    placementRequest,
  };
};

// ======================================================
// LOAD ONE CONTEXT
// ======================================================

const loadInterviewContext = async ({ interview, registerId }) => {
  const sourceType = getSourceType(interview);

  const provider = await Provider.findOne({
    registerId,
    role: "provider",
  });

  if (sourceType === "PLACEMENT") {
    const [placementCandidate, recruit] = await Promise.all([
      PlacementCandidate.findOne({
        placementCandidateId: interview.placement_candidate_id,

        providerId: registerId,
      }),

      Recruit.findOne({
        recruitId: interview.recruit_id,

        company_id: registerId,
      }),
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

      provider_id: registerId,
    }),

    Vacancy.findOne({
      vacancyId: interview.vacancy_id,

      registerId,
    }),
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

// ======================================================
// NOTIFY SAFELY
// ======================================================

const notifySeekerSafely = async ({
  interview,
  application,
  vacancy,
  recruit,
  provider,
  eventType,
}) => {
  try {
    await notifySeekerAboutInterview({
      interview,
      application,
      vacancy,
      recruit,
      provider,
      eventType,
    });
  } catch (error) {
    console.error("INTERVIEW NOTIFICATION ERROR:", error);
  }
};

// ======================================================
// GET ALL
// ======================================================

exports.getProviderInterviews = async (req, res) => {
  try {
    const registerId = req.registerId;

    if (!registerId) {
      return res.status(401).json({
        status: "error",

        message: "Provider authentication required.",
      });
    }

    const requestedStatus = normalizeString(req.query.status).toUpperCase();

    const query = {
      provider_id: registerId,
    };

    if (requestedStatus) {
      if (!PROVIDER_VISIBLE_INTERVIEW_STATUSES.includes(requestedStatus)) {
        return res.status(400).json({
          status: "error",

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
      const context = await loadInterviewContext({
        interview,
        registerId,
      });

      data.push(
        toProviderInterview({
          interview,
          ...context,
        }),
      );
    }

    return res.status(200).json({
      status: "success",

      count: data.length,

      data,
    });
  } catch (error) {
    console.error("GET PROVIDER INTERVIEWS ERROR:", error);

    return res.status(500).json({
      status: "error",

      message: "Failed to load interviews.",
    });
  }
};

// ======================================================
// GET ONE
// ======================================================

exports.getProviderInterviewById = async (req, res) => {
  try {
    const registerId = req.registerId;

    const { interviewId } = req.params;

    const interview = await Interview.findOne({
      interview_id: interviewId,

      provider_id: registerId,
    });

    if (!interview) {
      return res.status(404).json({
        status: "error",

        message: "Interview not found.",
      });
    }

    const context = await loadInterviewContext({
      interview,
      registerId,
    });

    return res.status(200).json({
      status: "success",

      data: toProviderInterview({
        interview,
        ...context,
      }),
    });
  } catch (error) {
    console.error("GET PROVIDER INTERVIEW ERROR:", error);

    return res.status(500).json({
      status: "error",

      message: "Failed to load interview.",
    });
  }
};

// ======================================================
// SCHEDULE
//
// Supports:
//
// APPLICATION:
// { applicationId }
//
// PLACEMENT:
// { placementCandidateId }
// ======================================================

exports.scheduleProviderInterview = async (req, res) => {
  let createdInterview = null;

  try {
    const registerId = req.registerId;

    const applicationId = normalizeString(req.body.applicationId);

    const placementCandidateId = normalizeString(req.body.placementCandidateId);

    if (
      (!applicationId && !placementCandidateId) ||
      (applicationId && placementCandidateId)
    ) {
      return res.status(400).json({
        status: "error",

        message: "Provide either applicationId or placementCandidateId.",
      });
    }

    const interviewDate = parseInterviewDate(req.body.interviewDate);

    const interviewTime = normalizeString(req.body.interviewTime);

    const timezone = normalizeString(req.body.timezone) || "Asia/Tokyo";

    const interviewMethod = normalizeString(
      req.body.interviewMethod,
    ).toUpperCase();

    const meetingLink = normalizeString(req.body.meetingLink) || null;

    const notes = normalizeString(req.body.notes) || null;

    if (!interviewDate) {
      return res.status(400).json({
        status: "error",

        message: "A valid interviewDate is required.",
      });
    }

    if (!isValidInterviewTime(interviewTime)) {
      return res.status(400).json({
        status: "error",

        message: "interviewTime must use HH:mm format.",
      });
    }

    if (!INTERVIEW_METHODS.includes(interviewMethod)) {
      return res.status(400).json({
        status: "error",

        message: "Invalid interview method.",
      });
    }

    if (notes && notes.length > 2000) {
      return res.status(400).json({
        status: "error",

        message: "Notes cannot exceed 2000 characters.",
      });
    }

    if (meetingLink && meetingLink.length > 2000) {
      return res.status(400).json({
        status: "error",

        message: "Meeting link is too long.",
      });
    }

    const interviewStatus = determineInterviewStatus({
      interviewMethod,
      meetingLink,
    });

    const now = new Date();

    // ==================================================
    // APPLICATION INTERVIEW
    // ==================================================

    if (applicationId) {
      const application = await Application.findOne({
        application_id: applicationId,

        provider_id: registerId,
      });

      if (!application) {
        return res.status(404).json({
          status: "error",

          message: "Application not found.",
        });
      }

      if (
        !INTERVIEW_ELIGIBLE_APPLICATION_STATUSES.includes(application.status)
      ) {
        return res.status(409).json({
          status: "error",

          message:
            "This application cannot be scheduled for interview in its current status.",
        });
      }

      const existing = await Interview.findOne({
        application_id: application.application_id,
      });

      if (existing) {
        return res.status(409).json({
          status: "error",

          message: "An interview already exists for this application.",
        });
      }

      const vacancy = await Vacancy.findOne({
        vacancyId: application.vacancy_id,

        registerId,
      });

      if (!vacancy) {
        return res.status(404).json({
          status: "error",

          message: "Related vacancy not found.",
        });
      }

      createdInterview = await Interview.create({
        interview_id: generateInterviewId(),

        source_type: "APPLICATION",

        application_id: application.application_id,

        vacancy_id: application.vacancy_id,

        seeker_id: application.seeker_id,

        provider_id: application.provider_id,

        interview_date: interviewDate,

        interview_time: interviewTime,

        timezone,

        interview_method: interviewMethod,

        meeting_link: meetingLink,

        notes,

        status: interviewStatus,

        scheduled_by_role: "provider",

        scheduled_by_id: registerId,

        updated_by_role: "provider",

        updated_by_id: registerId,

        confirmed_at: interviewStatus === "CONFIRMED" ? now : null,
      });

      application.status = "INTERVIEW";

      try {
        await application.save();
      } catch (applicationError) {
        await Interview.deleteOne({
          _id: createdInterview._id,
        });

        throw applicationError;
      }

      if (createdInterview.status === "CONFIRMED") {
        await notifySeekerSafely({
          interview: createdInterview,

          application,

          vacancy,

          recruit: null,

          provider: req.provider || null,

          eventType: "INTERVIEW_SCHEDULED",
        });
      }

      return res.status(201).json({
        status: "success",

        message:
          createdInterview.status === "AWAITING_LINK"
            ? "Interview scheduled. A meeting link must be added before the candidate receives the final interview notification."
            : "Interview scheduled and confirmed successfully.",

        data: toProviderInterview({
          interview: createdInterview,

          application,

          vacancy,

          placementCandidate: null,

          recruit: null,

          provider: req.provider || null,
        }),
      });
    }

    // ==================================================
    // PLACEMENT INTERVIEW
    // ==================================================

    const placementCandidate = await PlacementCandidate.findOne({
      placementCandidateId,

      providerId: registerId,
    });

    if (!placementCandidate) {
      return res.status(404).json({
        status: "error",

        message: "Placement candidate not found.",
      });
    }

    if (!["UNDER_REVIEW", "INTERVIEW"].includes(placementCandidate.status)) {
      return res.status(409).json({
        status: "error",

        message:
          "This placement candidate cannot be scheduled for interview in its current status.",
      });
    }

    const existing = await Interview.findOne({
      placement_candidate_id: placementCandidateId,
    });

    if (existing) {
      return res.status(409).json({
        status: "error",

        message: "An interview already exists for this placement candidate.",
      });
    }

    const recruit = await Recruit.findOne({
      recruitId: placementCandidate.recruitId,

      company_id: registerId,

      status: "approved",
    });

    if (!recruit) {
      return res.status(404).json({
        status: "error",

        message: "Related placement request not found.",
      });
    }

    const provider = await Provider.findOne({
      registerId,
      role: "provider",
    });

    createdInterview = await Interview.create({
      interview_id: generateInterviewId(),

      source_type: "PLACEMENT",

      placement_candidate_id: placementCandidate.placementCandidateId,

      recruit_id: placementCandidate.recruitId,

      seeker_id: placementCandidate.seekerId,

      provider_id: placementCandidate.providerId,

      interview_date: interviewDate,

      interview_time: interviewTime,

      timezone,

      interview_method: interviewMethod,

      meeting_link: meetingLink,

      notes,

      status: interviewStatus,

      scheduled_by_role: "provider",

      scheduled_by_id: registerId,

      updated_by_role: "provider",

      updated_by_id: registerId,

      confirmed_at: interviewStatus === "CONFIRMED" ? now : null,
    });

    const previousStatus = placementCandidate.status;

    placementCandidate.status = "INTERVIEW";

    placementCandidate.interviewAt = now;

    try {
      await placementCandidate.save();
    } catch (candidateError) {
      await Interview.deleteOne({
        _id: createdInterview._id,
      });

      placementCandidate.status = previousStatus;

      throw candidateError;
    }

    if (createdInterview.status === "CONFIRMED") {
      await notifySeekerSafely({
        interview: createdInterview,

        application: null,

        vacancy: null,

        recruit,

        provider,

        eventType: "INTERVIEW_SCHEDULED",
      });
    }

    return res.status(201).json({
      status: "success",

      message:
        createdInterview.status === "AWAITING_LINK"
          ? "Placement interview scheduled. A meeting link must be added before the candidate receives the final notification."
          : "Placement interview scheduled and confirmed successfully.",

      data: toProviderInterview({
        interview: createdInterview,

        application: null,

        vacancy: null,

        placementCandidate,

        recruit,

        provider,
      }),
    });
  } catch (error) {
    console.error("SCHEDULE PROVIDER INTERVIEW ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        status: "error",

        message: "An interview already exists for this candidate.",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        status: "error",

        message: error.message,
      });
    }

    return res.status(500).json({
      status: "error",

      message: "Failed to schedule interview.",
    });
  }
};

// ======================================================
// UPDATE / RESCHEDULE
// ======================================================

exports.updateProviderInterview = async (req, res) => {
  try {
    const registerId = req.registerId;

    const { interviewId } = req.params;

    const interview = await Interview.findOne({
      interview_id: interviewId,

      provider_id: registerId,
    });

    if (!interview) {
      return res.status(404).json({
        status: "error",

        message: "Interview not found.",
      });
    }

    if (["CANCELLED", "COMPLETED"].includes(interview.status)) {
      return res.status(409).json({
        status: "error",

        message: "This interview can no longer be modified.",
      });
    }

    const context = await loadInterviewContext({
      interview,
      registerId,
    });

    if (context.sourceType === "PLACEMENT") {
      if (!context.placementCandidate) {
        return res.status(404).json({
          status: "error",

          message: "Related placement candidate not found.",
        });
      }

      if (context.placementCandidate.status !== "INTERVIEW") {
        return res.status(409).json({
          status: "error",

          message:
            "Interview details can only be modified while the placement candidate is in the interview stage.",
        });
      }
    } else {
      if (!context.application) {
        return res.status(404).json({
          status: "error",

          message: "Related application not found.",
        });
      }

      if (context.application.status !== "INTERVIEW") {
        return res.status(409).json({
          status: "error",

          message:
            "Interview details can only be modified while the application is in the interview stage.",
        });
      }
    }

    const previousStatus = interview.status;

    const previousDate = interview.interview_date
      ? new Date(interview.interview_date).getTime()
      : null;

    const previousTime = interview.interview_time;

    const previousTimezone = interview.timezone;

    const previousMethod = interview.interview_method;

    const previousMeetingLink = interview.meeting_link || null;

    const previousNotes = interview.notes || null;

    if (req.body.interviewDate !== undefined) {
      const value = parseInterviewDate(req.body.interviewDate);

      if (!value) {
        return res.status(400).json({
          status: "error",

          message: "A valid interviewDate is required.",
        });
      }

      interview.interview_date = value;
    }

    if (req.body.interviewTime !== undefined) {
      const value = normalizeString(req.body.interviewTime);

      if (!isValidInterviewTime(value)) {
        return res.status(400).json({
          status: "error",

          message: "interviewTime must use HH:mm format.",
        });
      }

      interview.interview_time = value;
    }

    if (req.body.timezone !== undefined) {
      const value = normalizeString(req.body.timezone);

      if (!value) {
        return res.status(400).json({
          status: "error",

          message: "timezone cannot be empty.",
        });
      }

      interview.timezone = value;
    }

    if (req.body.interviewMethod !== undefined) {
      const value = normalizeString(req.body.interviewMethod).toUpperCase();

      if (!INTERVIEW_METHODS.includes(value)) {
        return res.status(400).json({
          status: "error",

          message: "Invalid interview method.",
        });
      }

      interview.interview_method = value;
    }

    if (req.body.meetingLink !== undefined) {
      const value = normalizeString(req.body.meetingLink) || null;

      if (value && value.length > 2000) {
        return res.status(400).json({
          status: "error",

          message: "Meeting link is too long.",
        });
      }

      interview.meeting_link = value;
    }

    if (req.body.notes !== undefined) {
      const value = normalizeString(req.body.notes) || null;

      if (value && value.length > 2000) {
        return res.status(400).json({
          status: "error",

          message: "Notes cannot exceed 2000 characters.",
        });
      }

      interview.notes = value;
    }

    const nextStatus = determineInterviewStatus({
      interviewMethod: interview.interview_method,

      meetingLink: interview.meeting_link,
    });

    interview.status = nextStatus;

    interview.updated_by_role = "provider";

    interview.updated_by_id = registerId;

    if (nextStatus === "CONFIRMED" && previousStatus !== "CONFIRMED") {
      interview.confirmed_at = new Date();
    }

    if (nextStatus === "AWAITING_LINK") {
      interview.confirmed_at = null;
    }

    await interview.save();

    const currentDate = interview.interview_date
      ? new Date(interview.interview_date).getTime()
      : null;

    const detailsChanged =
      previousDate !== currentDate ||
      previousTime !== interview.interview_time ||
      previousTimezone !== interview.timezone ||
      previousMethod !== interview.interview_method ||
      previousMeetingLink !== (interview.meeting_link || null) ||
      previousNotes !== (interview.notes || null);

    if (interview.status === "CONFIRMED") {
      if (previousStatus !== "CONFIRMED") {
        await notifySeekerSafely({
          interview,

          ...context,

          eventType: "INTERVIEW_CONFIRMED",
        });
      } else if (detailsChanged) {
        await notifySeekerSafely({
          interview,

          ...context,

          eventType: "INTERVIEW_UPDATED",
        });
      }
    }

    return res.status(200).json({
      status: "success",

      message:
        interview.status === "AWAITING_LINK"
          ? "Interview updated. A meeting link is still required."
          : previousStatus === "AWAITING_LINK" &&
              interview.status === "CONFIRMED"
            ? "Interview meeting link added and interview confirmed."
            : "Interview updated successfully.",

      data: toProviderInterview({
        interview,
        ...context,
      }),
    });
  } catch (error) {
    console.error("UPDATE PROVIDER INTERVIEW ERROR:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        status: "error",

        message: error.message,
      });
    }

    return res.status(500).json({
      status: "error",

      message: "Failed to update interview.",
    });
  }
};
