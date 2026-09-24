const Interview = require("../../models/interviews/interviewSchema");

const Application = require("../../models/applications/applicationSchema");

const Vacancy = require("../../models/providers/vacancySchema");

const Provider = require("../../models/providers/registerSchema");

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
// INTERVIEW STATUSES
// ======================================================

const INTERVIEW_STATUSES = [
  "AWAITING_LINK",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
];

// ======================================================
// ONLINE INTERVIEW METHODS
// ======================================================

const ONLINE_INTERVIEW_METHODS = ["ZOOM", "GOOGLE_MEET"];

// ======================================================
// SAFE STRING
// ======================================================

const normalizeString = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

// ======================================================
// VALIDATE TIME
// ======================================================

const isValidInterviewTime = (value) => {
  if (typeof value !== "string") {
    return false;
  }

  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value.trim());
};

// ======================================================
// PARSE DATE
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

const determineInterviewStatus = ({ interviewMethod, meetingLink }) => {
  if (ONLINE_INTERVIEW_METHODS.includes(interviewMethod) && !meetingLink) {
    return "AWAITING_LINK";
  }

  return "CONFIRMED";
};

// ======================================================
// NOTIFY SEEKER SAFELY
// ======================================================
//
// Interview coordination must not fail because of
// notification/email failure.
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
    console.error("STAFF INTERVIEW NOTIFICATION ERROR:", error);
  }
};

// ======================================================
// LOAD RELATED DATA
// ======================================================

const loadRelatedData = async (interviews) => {
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

  const providerIds = [
    ...new Set(
      interviews.map((interview) => interview.provider_id).filter(Boolean),
    ),
  ];

  const [applications, vacancies, providers] = await Promise.all([
    applicationIds.length
      ? Application.find({
          application_id: {
            $in: applicationIds,
          },
        }).lean()
      : [],

    vacancyIds.length
      ? Vacancy.find({
          vacancyId: {
            $in: vacancyIds,
          },
        }).lean()
      : [],

    providerIds.length
      ? Provider.find({
          registerId: {
            $in: providerIds,
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

    providerMap: new Map(
      providers.map((provider) => [provider.registerId, provider]),
    ),
  };
};

// ======================================================
// STAFF INTERVIEW SERIALIZER
// ======================================================
//
// IMPORTANT:
//
// Staff receives professional candidate information only.
//
// Do NOT expose:
//
// email
// phone
// address
// profile photo
// private documents
//
// ======================================================

const toStaffInterview = ({ interview, application, vacancy, provider }) => {
  const data = interview?.toObject ? interview.toObject() : interview;

  return {
    interviewId: data.interview_id,

    applicationId: data.application_id,

    vacancyId: data.vacancy_id,

    providerId: data.provider_id,

    applicationStatus: application?.status || null,

    interviewDate: data.interview_date,

    interviewTime: data.interview_time,

    timezone: data.timezone,

    interviewMethod: data.interview_method,

    meetingLink: data.meeting_link || null,

    notes: data.notes || null,

    status: data.status,

    scheduledBy: {
      role: data.scheduled_by_role,

      id: data.scheduled_by_id,
    },

    updatedBy: {
      role: data.updated_by_role,

      id: data.updated_by_id,
    },

    confirmedAt: data.confirmed_at || null,

    notificationSentAt: data.notification_sent_at || null,

    completedAt: data.completed_at || null,

    cancelledAt: data.cancelled_at || null,

    cancellationReason: data.cancellation_reason || null,

    createdAt: data.created_at,

    updatedAt: data.updated_at,

    candidate: {
      name: application?.profile_snapshot?.name || null,

      nationality: application?.profile_snapshot?.nationality || null,

      visaType: application?.profile_snapshot?.visa_type || null,

      visaExpiryDate: application?.profile_snapshot?.visa_expiry_date || null,

      japaneseLevel: application?.profile_snapshot?.japanese_level || null,

      skills: application?.profile_snapshot?.skills || [],

      desiredJob: application?.profile_snapshot?.desired_job || null,

      desiredLocation: application?.profile_snapshot?.desired_location || null,
    },

    vacancy: {
      vacancyId: vacancy?.vacancyId || data.vacancy_id,

      title: vacancy?.title || null,

      companyName: vacancy?.companyName || provider?.companyName || null,

      employmentType: vacancy?.employmentType || null,

      workLocation: vacancy?.workLocation || null,
    },

    provider: {
      registerId: provider?.registerId || data.provider_id,

      name: provider?.name || null,

      companyName: provider?.companyName || vacancy?.companyName || null,
    },
  };
};

// ======================================================
// GET STAFF INTERVIEWS
//
// GET
// /api/staff/interviews
//
// Permission:
// interviews:view
//
// Optional:
//
// ?status=CONFIRMED
// ?method=ZOOM
// ?search=keyword
//
// ======================================================

exports.getStaffInterviews = async (req, res) => {
  try {
    const status = normalizeString(req.query.status).toUpperCase();

    const method = normalizeString(req.query.method).toUpperCase();

    const search = normalizeString(req.query.search).toLowerCase();

    const query = {};

    // ==================================================
    // STATUS
    // ==================================================

    if (status) {
      if (!INTERVIEW_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,

          message: "Invalid interview status.",
        });
      }

      query.status = status;
    }

    // ==================================================
    // METHOD
    // ==================================================

    if (method) {
      if (!INTERVIEW_METHODS.includes(method)) {
        return res.status(400).json({
          success: false,

          message: "Invalid interview method.",
        });
      }

      query.interview_method = method;
    }

    // ==================================================
    // LOAD
    // ==================================================

    const interviews = await Interview.find(query)
      .sort({
        interview_date: 1,
        interview_time: 1,
        created_at: -1,
      })
      .lean();

    const { applicationMap, vacancyMap, providerMap } =
      await loadRelatedData(interviews);

    let data = interviews.map((interview) =>
      toStaffInterview({
        interview,

        application: applicationMap.get(interview.application_id),

        vacancy: vacancyMap.get(interview.vacancy_id),

        provider: providerMap.get(interview.provider_id),
      }),
    );

    // ==================================================
    // SEARCH
    // ==================================================

    if (search) {
      data = data.filter((interview) => {
        const searchable = [
          interview.interviewId,

          interview.applicationId,

          interview.vacancyId,

          interview.providerId,

          interview.status,

          interview.interviewMethod,

          interview.candidate?.name,

          interview.candidate?.nationality,

          interview.candidate?.japaneseLevel,

          interview.vacancy?.title,

          interview.vacancy?.companyName,

          interview.provider?.name,

          interview.provider?.companyName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(search);
      });
    }

    // ==================================================
    // SUMMARY
    // ==================================================

    const [total, awaitingLink, confirmed, completed, cancelled] =
      await Promise.all([
        Interview.countDocuments(),

        Interview.countDocuments({
          status: "AWAITING_LINK",
        }),

        Interview.countDocuments({
          status: "CONFIRMED",
        }),

        Interview.countDocuments({
          status: "COMPLETED",
        }),

        Interview.countDocuments({
          status: "CANCELLED",
        }),
      ]);

    return res.status(200).json({
      success: true,

      count: data.length,

      summary: {
        total,

        awaitingLink,

        confirmed,

        completed,

        cancelled,
      },

      data,
    });
  } catch (error) {
    console.error("GET STAFF INTERVIEWS ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load interviews.",
    });
  }
};

// ======================================================
// GET ONE STAFF INTERVIEW
//
// GET
// /api/staff/interviews/:interviewId
//
// Permission:
// interviews:view
//
// ======================================================

exports.getStaffInterviewById = async (req, res) => {
  try {
    const { interviewId } = req.params;

    const interview = await Interview.findOne({
      interview_id: interviewId,
    });

    if (!interview) {
      return res.status(404).json({
        success: false,

        message: "Interview not found.",
      });
    }

    const [application, vacancy, provider] = await Promise.all([
      Application.findOne({
        application_id: interview.application_id,
      }),

      Vacancy.findOne({
        vacancyId: interview.vacancy_id,
      }),

      Provider.findOne({
        registerId: interview.provider_id,
      }),
    ]);

    return res.status(200).json({
      success: true,

      data: toStaffInterview({
        interview,
        application,
        vacancy,
        provider,
      }),
    });
  } catch (error) {
    console.error("GET STAFF INTERVIEW ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load interview.",
    });
  }
};

// ======================================================
// UPDATE / COORDINATE INTERVIEW
//
// PATCH
// /api/staff/interviews/:interviewId
//
// Permission:
// interviews:manage
//
// Staff can:
//
// - change date
// - change time
// - change timezone
// - change method
// - add/update meeting link
// - update notes
//
// ======================================================

exports.updateStaffInterview = async (req, res) => {
  try {
    const { interviewId } = req.params;

    const interview = await Interview.findOne({
      interview_id: interviewId,
    });

    if (!interview) {
      return res.status(404).json({
        success: false,

        message: "Interview not found.",
      });
    }

    // ==================================================
    // CLOSED INTERVIEW
    // ==================================================

    if (interview.status === "COMPLETED" || interview.status === "CANCELLED") {
      return res.status(409).json({
        success: false,

        message: "This interview can no longer be modified.",
      });
    }

    // ==================================================
    // APPLICATION
    // ==================================================

    const application = await Application.findOne({
      application_id: interview.application_id,
    });

    if (!application) {
      return res.status(404).json({
        success: false,

        message: "Related application not found.",
      });
    }

    if (application.status !== "INTERVIEW") {
      return res.status(409).json({
        success: false,

        message:
          "Interview information can only be modified while the application is in the interview stage.",
      });
    }

    // ==================================================
    // RELATED DATA
    // ==================================================

    const [vacancy, provider] = await Promise.all([
      Vacancy.findOne({
        vacancyId: interview.vacancy_id,
      }),

      Provider.findOne({
        registerId: interview.provider_id,
      }),
    ]);

    if (!vacancy) {
      return res.status(404).json({
        success: false,

        message: "Related vacancy not found.",
      });
    }

    // ==================================================
    // PREVIOUS VALUES
    // ==================================================

    const previousStatus = interview.status;

    const previousDate = interview.interview_date
      ? new Date(interview.interview_date).getTime()
      : null;

    const previousTime = interview.interview_time;

    const previousTimezone = interview.timezone;

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
          success: false,

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
          success: false,

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
          success: false,

          message: "timezone cannot be empty.",
        });
      }

      if (timezone.length > 100) {
        return res.status(400).json({
          success: false,

          message: "timezone is too long.",
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
          success: false,

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
          success: false,

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
          success: false,

          message: "Notes cannot exceed 2000 characters.",
        });
      }

      interview.notes = notes;
    }

    // ==================================================
    // STATUS
    // ==================================================

    const nextStatus = determineInterviewStatus({
      interviewMethod: interview.interview_method,

      meetingLink: interview.meeting_link,
    });

    interview.status = nextStatus;

    // ==================================================
    // AUDIT
    // ==================================================

    interview.updated_by_role = "staff";

    interview.updated_by_id = req.staff.staffId;

    // ==================================================
    // CONFIRMATION
    // ==================================================

    if (nextStatus === "CONFIRMED" && previousStatus !== "CONFIRMED") {
      interview.confirmed_at = new Date();
    }

    if (nextStatus === "AWAITING_LINK") {
      interview.confirmed_at = null;
    }

    await interview.save();

    // ==================================================
    // CHECK IF DETAILS CHANGED
    // ==================================================

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

    // ==================================================
    // NOTIFICATION
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

    // ==================================================
    // RESPONSE
    // ==================================================

    return res.status(200).json({
      success: true,

      message:
        interview.status === "AWAITING_LINK"
          ? "Interview updated. A meeting link is still required."
          : previousStatus === "AWAITING_LINK" &&
              interview.status === "CONFIRMED"
            ? "Interview meeting link added and interview confirmed."
            : "Interview updated successfully.",

      data: toStaffInterview({
        interview,
        application,
        vacancy,
        provider,
      }),
    });
  } catch (error) {
    console.error("UPDATE STAFF INTERVIEW ERROR:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,

        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,

      message: "Failed to update interview.",
    });
  }
};
