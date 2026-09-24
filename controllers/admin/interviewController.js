const Interview = require("../../models/interviews/interviewSchema");

const Application = require("../../models/applications/applicationSchema");

const Seeker = require("../../models/seekers/seekerSchema");

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
// NOTIFY SAFELY
// ======================================================
//
// Interview update must still succeed even if email fails.
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
    console.error("ADMIN INTERVIEW NOTIFICATION ERROR:", error);
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

  const seekerIds = [
    ...new Set(
      interviews.map((interview) => interview.seeker_id).filter(Boolean),
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

  const [applications, seekers, vacancies, providers] = await Promise.all([
    applicationIds.length
      ? Application.find({
          application_id: {
            $in: applicationIds,
          },
        }).lean()
      : [],

    seekerIds.length
      ? Seeker.find({
          seeker_id: {
            $in: seekerIds,
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

    seekerMap: new Map(seekers.map((seeker) => [seeker.seeker_id, seeker])),

    vacancyMap: new Map(
      vacancies.map((vacancy) => [vacancy.vacancyId, vacancy]),
    ),

    providerMap: new Map(
      providers.map((provider) => [provider.registerId, provider]),
    ),
  };
};

// ======================================================
// ADMIN INTERVIEW SERIALIZER
// ======================================================
//
// Admin may access full operational information.
//
// ======================================================

const toAdminInterview = ({
  interview,
  application,
  seeker,
  vacancy,
  provider,
}) => {
  const data = interview?.toObject ? interview.toObject() : interview;

  return {
    interviewId: data.interview_id,

    applicationId: data.application_id,

    seekerId: data.seeker_id,

    providerId: data.provider_id,

    vacancyId: data.vacancy_id,

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
      seekerId: seeker?.seeker_id || data.seeker_id,

      name: seeker?.name || application?.profile_snapshot?.name || null,

      email: seeker?.email || null,

      phone: seeker?.phone || null,

      currentLocation: seeker?.current_location || null,

      nationality:
        seeker?.nationality ||
        application?.profile_snapshot?.nationality ||
        null,

      visaType:
        seeker?.visa_type || application?.profile_snapshot?.visa_type || null,

      japaneseLevel:
        seeker?.japanese_level ||
        application?.profile_snapshot?.japanese_level ||
        null,
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

      email: provider?.email || null,
    },
  };
};

// ======================================================
// GET ALL ADMIN INTERVIEWS
//
// GET
// /api/admin/interviews
//
// Optional:
//
// ?status=CONFIRMED
// ?method=ZOOM
// ?search=keyword
//
// ======================================================

exports.getAdminInterviews = async (req, res) => {
  try {
    const status = normalizeString(req.query.status).toUpperCase();

    const method = normalizeString(req.query.method).toUpperCase();

    const search = normalizeString(req.query.search).toLowerCase();

    const query = {};

    // ==================================================
    // STATUS FILTER
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
    // METHOD FILTER
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
    // LOAD INTERVIEWS
    // ==================================================

    const interviews = await Interview.find(query)
      .sort({
        interview_date: 1,
        interview_time: 1,
        created_at: -1,
      })
      .lean();

    const { applicationMap, seekerMap, vacancyMap, providerMap } =
      await loadRelatedData(interviews);

    let data = interviews.map((interview) =>
      toAdminInterview({
        interview,

        application: applicationMap.get(interview.application_id),

        seeker: seekerMap.get(interview.seeker_id),

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

          interview.seekerId,

          interview.providerId,

          interview.vacancyId,

          interview.status,

          interview.interviewMethod,

          interview.candidate?.name,

          interview.candidate?.email,

          interview.candidate?.phone,

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

    const summary = {
      total: await Interview.countDocuments(),

      awaitingLink: await Interview.countDocuments({
        status: "AWAITING_LINK",
      }),

      confirmed: await Interview.countDocuments({
        status: "CONFIRMED",
      }),

      completed: await Interview.countDocuments({
        status: "COMPLETED",
      }),

      cancelled: await Interview.countDocuments({
        status: "CANCELLED",
      }),
    };

    return res.status(200).json({
      success: true,

      count: data.length,

      summary,

      data,
    });
  } catch (error) {
    console.error("GET ADMIN INTERVIEWS ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load interviews.",
    });
  }
};

// ======================================================
// GET ONE ADMIN INTERVIEW
//
// GET
// /api/admin/interviews/:interviewId
//
// ======================================================

exports.getAdminInterviewById = async (req, res) => {
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

    const [application, seeker, vacancy, provider] = await Promise.all([
      Application.findOne({
        application_id: interview.application_id,
      }),

      Seeker.findOne({
        seeker_id: interview.seeker_id,
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

      data: toAdminInterview({
        interview,
        application,
        seeker,
        vacancy,
        provider,
      }),
    });
  } catch (error) {
    console.error("GET ADMIN INTERVIEW ERROR:", error);

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
// /api/admin/interviews/:interviewId
//
// Admin may:
//
// - change date
// - change time
// - change timezone
// - change method
// - add/change meeting link
// - update notes
//
// ======================================================

exports.updateAdminInterview = async (req, res) => {
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
    // CLOSED INTERVIEWS
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

    const [seeker, vacancy, provider] = await Promise.all([
      Seeker.findOne({
        seeker_id: interview.seeker_id,
      }),

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
    // RECALCULATE STATUS
    // ==================================================

    const nextStatus = determineInterviewStatus({
      interviewMethod: interview.interview_method,

      meetingLink: interview.meeting_link,
    });

    interview.status = nextStatus;

    // ==================================================
    // AUDIT
    // ==================================================

    interview.updated_by_role = "admin";

    interview.updated_by_id = req.admin.adminId;

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
    // DETECT CHANGES
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
    // NOTIFY SEEKER
    // ==================================================

    if (interview.status === "CONFIRMED") {
      // ------------------------------------------------
      // Meeting link was added or interview became ready.
      // ------------------------------------------------

      if (previousStatus !== "CONFIRMED") {
        await notifySeekerSafely({
          interview,
          application,
          vacancy,

          eventType: "INTERVIEW_CONFIRMED",
        });
      }

      // ------------------------------------------------
      // Already-confirmed interview was changed.
      // ------------------------------------------------
      else if (detailsChanged) {
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

      data: toAdminInterview({
        interview,
        application,
        seeker,
        vacancy,
        provider,
      }),
    });
  } catch (error) {
    console.error("UPDATE ADMIN INTERVIEW ERROR:", error);

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
