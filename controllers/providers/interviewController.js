const crypto = require("crypto");

const Interview = require("../../models/interviews/interviewSchema");
const Application = require("../../models/applications/applicationSchema");
const Vacancy = require("../../models/providers/vacancySchema");

const {
  notifySeekerAboutInterview,
} = require("../../services/interviewNotificationService");

// ======================================================
// INTERVIEW METHODS
// ======================================================

const INTERVIEW_METHODS = [
  "ZOOM",
  "GOOGLE_MEET",
  "PHONE",
  "FACE_TO_FACE",
  "OTHER",
];

// ======================================================
// PROVIDER VISIBLE INTERVIEW STATUSES
// ======================================================

const PROVIDER_VISIBLE_INTERVIEW_STATUSES = [
  "AWAITING_LINK",
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
];

// ======================================================
// APPLICATION STATUSES THAT CAN ENTER INTERVIEW
// ======================================================
//
// Provider may schedule an interview when:
//
// SENT_TO_PROVIDER
// UNDER_REVIEW
//
// Once scheduled:
//
// application.status = INTERVIEW
//
// ======================================================

const INTERVIEW_ELIGIBLE_APPLICATION_STATUSES = [
  "SENT_TO_PROVIDER",
  "UNDER_REVIEW",
];

// ======================================================
// ONLINE INTERVIEW METHODS
// ======================================================

const ONLINE_INTERVIEW_METHODS = ["ZOOM", "GOOGLE_MEET"];

// ======================================================
// GENERATE INTERVIEW ID
//
// Example:
//
// INT-A12B34CD
//
// ======================================================

const generateInterviewId = () => {
  return `INT-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
};

// ======================================================
// STRING VALUE
// ======================================================

const normalizeString = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

// ======================================================
// VALIDATE INTERVIEW TIME
//
// Expected:
//
// HH:mm
//
// Examples:
//
// 09:00
// 14:30
//
// ======================================================

const isValidInterviewTime = (value) => {
  if (typeof value !== "string") {
    return false;
  }

  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value.trim());
};

// ======================================================
// PARSE INTERVIEW DATE
//
// Expected frontend examples:
//
// 2026-09-28
// 2026-09-28T00:00:00.000Z
//
// ======================================================

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

// ======================================================
// DETERMINE INTERVIEW STATUS
// ======================================================
//
// Zoom / Google Meet:
//
// without link:
// AWAITING_LINK
//
// with link:
// CONFIRMED
//
// Phone / Face-to-Face / Other:
//
// CONFIRMED
//
// ======================================================

const determineInterviewStatus = ({ interviewMethod, meetingLink }) => {
  if (ONLINE_INTERVIEW_METHODS.includes(interviewMethod) && !meetingLink) {
    return "AWAITING_LINK";
  }

  return "CONFIRMED";
};

// ======================================================
// PROVIDER-SAFE VACANCY SUMMARY
// ======================================================

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

// ======================================================
// PROVIDER-SAFE CANDIDATE SUMMARY
//
// IMPORTANT:
//
// Provider must NOT receive:
//
// seeker_id
// email
// phone
// address
// profile photo
// private documents
//
// ======================================================

const toCandidateSummary = (application) => {
  return {
    name: application?.profile_snapshot?.name || null,

    nationality: application?.profile_snapshot?.nationality || null,

    visaType: application?.profile_snapshot?.visa_type || null,

    visaExpiryDate: application?.profile_snapshot?.visa_expiry_date || null,

    japaneseLevel: application?.profile_snapshot?.japanese_level || null,

    skills: application?.profile_snapshot?.skills || [],

    desiredJob: application?.profile_snapshot?.desired_job || null,

    desiredLocation: application?.profile_snapshot?.desired_location || null,
  };
};

// ======================================================
// PROVIDER-SAFE INTERVIEW RESPONSE
// ======================================================

const toProviderInterview = ({ interview, application, vacancy }) => {
  const data = interview?.toObject ? interview.toObject() : interview;

  return {
    interviewId: data.interview_id,

    applicationId: data.application_id,

    vacancyId: data.vacancy_id,

    applicationStatus: application?.status || null,

    interviewDate: data.interview_date,

    interviewTime: data.interview_time,

    timezone: data.timezone,

    interviewMethod: data.interview_method,

    meetingLink: data.meeting_link || null,

    notes: data.notes || null,

    status: data.status,

    confirmedAt: data.confirmed_at || null,

    createdAt: data.created_at,

    updatedAt: data.updated_at,

    candidate: toCandidateSummary(application),

    vacancy: toVacancySummary(vacancy),
  };
};

// ======================================================
// LOAD RELATED DATA FOR INTERVIEWS
// ======================================================

const loadRelatedData = async ({ interviews, registerId }) => {
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

          provider_id: registerId,
        }).lean()
      : [],

    vacancyIds.length
      ? Vacancy.find({
          vacancyId: {
            $in: vacancyIds,
          },

          registerId,
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
// NOTIFY SEEKER SAFELY
//
// Interview scheduling must not fail just because
// an email provider is temporarily unavailable.
//
// System/email notification errors are logged.
//
// ======================================================

const notifySeekerSafely = async ({
  interview,
  application,
  vacancy,
  eventType,
}) => {
  try {
    await notifySeekerAboutInterview({
      interview,
      application,
      vacancy,
      eventType,
    });
  } catch (error) {
    console.error("INTERVIEW NOTIFICATION ERROR:", error);
  }
};

// ======================================================
// GET PROVIDER INTERVIEWS
//
// GET
// /api/providers/interviews
//
// Optional:
//
// ?status=CONFIRMED
//
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

    const requestedStatus = normalizeString(req.query.status);

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

    const { applicationMap, vacancyMap } = await loadRelatedData({
      interviews,
      registerId,
    });

    const data = interviews.map((interview) =>
      toProviderInterview({
        interview,

        application: applicationMap.get(interview.application_id),

        vacancy: vacancyMap.get(interview.vacancy_id),
      }),
    );

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
// GET PROVIDER INTERVIEW BY ID
//
// GET
// /api/providers/interviews/:interviewId
//
// ======================================================

exports.getProviderInterviewById = async (req, res) => {
  try {
    const registerId = req.registerId;

    const { interviewId } = req.params;

    if (!registerId) {
      return res.status(401).json({
        status: "error",

        message: "Provider authentication required.",
      });
    }

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

    return res.status(200).json({
      status: "success",

      data: toProviderInterview({
        interview,
        application,
        vacancy,
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
// SCHEDULE INTERVIEW
//
// POST
// /api/providers/interviews
//
// BODY:
//
// {
//   "applicationId": "APP-A12B34CD",
//   "interviewDate": "2026-09-30",
//   "interviewTime": "14:30",
//   "timezone": "Asia/Tokyo",
//   "interviewMethod": "ZOOM",
//   "meetingLink": "https://zoom.us/...",
//   "notes": "Please join 10 minutes early."
// }
//
// ======================================================

exports.scheduleProviderInterview = async (req, res) => {
  let createdInterview = null;

  try {
    const registerId = req.registerId;

    if (!registerId) {
      return res.status(401).json({
        status: "error",

        message: "Provider authentication required.",
      });
    }

    const applicationId = normalizeString(req.body.applicationId);

    const interviewDate = parseInterviewDate(req.body.interviewDate);

    const interviewTime = normalizeString(req.body.interviewTime);

    const timezone = normalizeString(req.body.timezone) || "Asia/Tokyo";

    const interviewMethod = normalizeString(
      req.body.interviewMethod,
    ).toUpperCase();

    const meetingLink = normalizeString(req.body.meetingLink) || null;

    const notes = normalizeString(req.body.notes) || null;

    // ==================================================
    // VALIDATION
    // ==================================================

    if (!applicationId) {
      return res.status(400).json({
        status: "error",

        message: "applicationId is required.",
      });
    }

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

    // ==================================================
    // FIND APPLICATION
    // ==================================================

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

    // ==================================================
    // APPLICATION MUST BE READY FOR INTERVIEW
    // ==================================================

    if (!INTERVIEW_ELIGIBLE_APPLICATION_STATUSES.includes(application.status)) {
      if (application.status === "INTERVIEW") {
        return res.status(409).json({
          status: "error",

          message: "This application is already in the interview stage.",
        });
      }

      return res.status(409).json({
        status: "error",

        message:
          "This application cannot be scheduled for interview in its current status.",
      });
    }

    // ==================================================
    // PREVENT DUPLICATE INTERVIEW
    //
    // One application has one interview record.
    //
    // Rescheduling is done by updating that record.
    // ==================================================

    const existingInterview = await Interview.findOne({
      application_id: application.application_id,
    });

    if (existingInterview) {
      return res.status(409).json({
        status: "error",

        message: "An interview already exists for this application.",
      });
    }

    // ==================================================
    // VERIFY VACANCY BELONGS TO PROVIDER
    // ==================================================

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

    // ==================================================
    // INTERVIEW STATUS
    // ==================================================

    const interviewStatus = determineInterviewStatus({
      interviewMethod,
      meetingLink,
    });

    const now = new Date();

    // ==================================================
    // CREATE INTERVIEW
    // ==================================================

    createdInterview = await Interview.create({
      interview_id: generateInterviewId(),

      application_id: application.application_id,

      seeker_id: application.seeker_id,

      provider_id: application.provider_id,

      vacancy_id: application.vacancy_id,

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

      notification_sent_at: null,
    });

    // ==================================================
    // MOVE APPLICATION TO INTERVIEW
    // ==================================================

    application.status = "INTERVIEW";

    try {
      await application.save();
    } catch (applicationError) {
      // ================================================
      // ROLLBACK INTERVIEW IF APPLICATION UPDATE FAILS
      // ================================================

      await Interview.deleteOne({
        _id: createdInterview._id,
      });

      createdInterview = null;

      throw applicationError;
    }

    // ==================================================
    // NOTIFICATION
    //
    // Requirement flow:
    //
    // Online interview without meeting link:
    // do not send final interview notification yet.
    //
    // Once link is added:
    // CONFIRMED → notify candidate.
    //
    // Phone / Face-to-Face / Other:
    // immediately CONFIRMED → notify candidate.
    // ==================================================

    if (createdInterview.status === "CONFIRMED") {
      await notifySeekerSafely({
        interview: createdInterview,

        application,

        vacancy,

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
      }),
    });
  } catch (error) {
    console.error("SCHEDULE PROVIDER INTERVIEW ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        status: "error",

        message: "An interview already exists for this application.",
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
// UPDATE / RESCHEDULE PROVIDER INTERVIEW
//
// PATCH
// /api/providers/interviews/:interviewId
//
// Provider can update:
//
// interviewDate
// interviewTime
// timezone
// interviewMethod
// meetingLink
// notes
//
// ======================================================

exports.updateProviderInterview = async (req, res) => {
  try {
    const registerId = req.registerId;

    const { interviewId } = req.params;

    if (!registerId) {
      return res.status(401).json({
        status: "error",

        message: "Provider authentication required.",
      });
    }

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

    if (interview.status === "CANCELLED" || interview.status === "COMPLETED") {
      return res.status(409).json({
        status: "error",

        message: "This interview can no longer be modified.",
      });
    }

    const application = await Application.findOne({
      application_id: interview.application_id,

      provider_id: registerId,
    });

    if (!application) {
      return res.status(404).json({
        status: "error",

        message: "Related application not found.",
      });
    }

    if (application.status !== "INTERVIEW") {
      return res.status(409).json({
        status: "error",

        message:
          "Interview details can only be modified while the application is in the interview stage.",
      });
    }

    const vacancy = await Vacancy.findOne({
      vacancyId: interview.vacancy_id,

      registerId,
    });

    if (!vacancy) {
      return res.status(404).json({
        status: "error",

        message: "Related vacancy not found.",
      });
    }

    const previousStatus = interview.status;

    const previousDate = interview.interview_date
      ? new Date(interview.interview_date).getTime()
      : null;

    const previousTime = interview.interview_time;

    const previousMethod = interview.interview_method;

    const previousMeetingLink = interview.meeting_link || null;

    const previousNotes = interview.notes || null;

    // ==================================================
    // DATE
    // ==================================================

    if (req.body.interviewDate !== undefined) {
      const interviewDate = parseInterviewDate(req.body.interviewDate);

      if (!interviewDate) {
        return res.status(400).json({
          status: "error",

          message: "A valid interviewDate is required.",
        });
      }

      interview.interview_date = interviewDate;
    }

    // ==================================================
    // TIME
    // ==================================================

    if (req.body.interviewTime !== undefined) {
      const interviewTime = normalizeString(req.body.interviewTime);

      if (!isValidInterviewTime(interviewTime)) {
        return res.status(400).json({
          status: "error",

          message: "interviewTime must use HH:mm format.",
        });
      }

      interview.interview_time = interviewTime;
    }

    // ==================================================
    // TIMEZONE
    // ==================================================

    if (req.body.timezone !== undefined) {
      const timezone = normalizeString(req.body.timezone);

      if (!timezone) {
        return res.status(400).json({
          status: "error",

          message: "timezone cannot be empty.",
        });
      }

      interview.timezone = timezone;
    }

    // ==================================================
    // METHOD
    // ==================================================

    if (req.body.interviewMethod !== undefined) {
      const interviewMethod = normalizeString(
        req.body.interviewMethod,
      ).toUpperCase();

      if (!INTERVIEW_METHODS.includes(interviewMethod)) {
        return res.status(400).json({
          status: "error",

          message: "Invalid interview method.",
        });
      }

      interview.interview_method = interviewMethod;
    }

    // ==================================================
    // MEETING LINK
    // ==================================================

    if (req.body.meetingLink !== undefined) {
      const meetingLink = normalizeString(req.body.meetingLink) || null;

      if (meetingLink && meetingLink.length > 2000) {
        return res.status(400).json({
          status: "error",

          message: "Meeting link is too long.",
        });
      }

      interview.meeting_link = meetingLink;
    }

    // ==================================================
    // NOTES
    // ==================================================

    if (req.body.notes !== undefined) {
      const notes = normalizeString(req.body.notes) || null;

      if (notes && notes.length > 2000) {
        return res.status(400).json({
          status: "error",

          message: "Notes cannot exceed 2000 characters.",
        });
      }

      interview.notes = notes;
    }

    // ==================================================
    // RECALCULATE STATUS
    // ==================================================

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

    // ==================================================
    // DETERMINE IF CONFIRMED DETAILS CHANGED
    // ==================================================

    const currentDate = interview.interview_date
      ? new Date(interview.interview_date).getTime()
      : null;

    const currentTime = interview.interview_time;

    const currentMethod = interview.interview_method;

    const currentMeetingLink = interview.meeting_link || null;

    const currentNotes = interview.notes || null;

    const detailsChanged =
      previousDate !== currentDate ||
      previousTime !== currentTime ||
      previousMethod !== currentMethod ||
      previousMeetingLink !== currentMeetingLink ||
      previousNotes !== currentNotes;

    // ==================================================
    // NOTIFY SEEKER
    //
    // Notify when:
    //
    // 1. AWAITING_LINK → CONFIRMED
    //
    // OR
    //
    // 2. Already confirmed interview was rescheduled /
    //    changed.
    // ==================================================

    if (interview.status === "CONFIRMED") {
      if (previousStatus !== "CONFIRMED") {
        await notifySeekerSafely({
          interview,
          application,
          vacancy,

          eventType: "INTERVIEW_CONFIRMED",
        });
      } else if (detailsChanged) {
        await notifySeekerSafely({
          interview,
          application,
          vacancy,

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
            ? "Interview link added and interview confirmed successfully."
            : "Interview updated successfully.",

      data: toProviderInterview({
        interview,
        application,
        vacancy,
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
