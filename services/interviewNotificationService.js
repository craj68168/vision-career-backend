const crypto = require("crypto");

const Notification = require("../models/notifications/notificationSchema");

const Seeker = require("../models/seekers/seekerSchema");

const sendEmail = require("../utils/send-email");

// ======================================================
// EVENTS
// ======================================================

const SUPPORTED_EVENTS = [
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_CONFIRMED",
  "INTERVIEW_UPDATED",
  "INTERVIEW_CANCELLED",
];

// ======================================================
// ID
// ======================================================

const generateNotificationId = () =>
  `NTF-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

// ======================================================
// STRING
// ======================================================

const safeString = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

// ======================================================
// METHOD LABEL
// ======================================================

const formatInterviewMethod = (method) => {
  const labels = {
    ZOOM: "Zoom",
    GOOGLE_MEET: "Google Meet",
    PHONE: "Phone",
    FACE_TO_FACE: "Face-to-Face",
    OTHER: "Other",
  };

  return labels[method] || method || "Not specified";
};

// ======================================================
// DATE
// ======================================================

const formatInterviewDate = (value, timezone) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: timezone || "Asia/Tokyo",
    }).format(date);
  } catch (error) {
    console.error("INTERVIEW DATE FORMAT ERROR:", error);

    return date.toISOString().slice(0, 10);
  }
};

// ======================================================
// JOB CONTEXT
//
// APPLICATION:
// vacancy
//
// PLACEMENT:
// recruit + provider
// ======================================================

const getJobContext = ({ vacancy, recruit, provider }) => {
  const companyName =
    safeString(vacancy?.companyName) ||
    safeString(provider?.companyName) ||
    "Company";

  const jobTitle =
    safeString(vacancy?.title) || safeString(recruit?.job_title) || "Job";

  return {
    companyName,
    jobTitle,
  };
};

// ======================================================
// NOTIFICATION CONTENT
// ======================================================

const buildNotificationContent = ({
  eventType,
  interview,
  vacancy,
  recruit,
  provider,
}) => {
  const { companyName, jobTitle } = getJobContext({
    vacancy,
    recruit,
    provider,
  });

  const interviewDate = formatInterviewDate(
    interview.interview_date,
    interview.timezone,
  );

  const interviewTime = interview.interview_time || "";

  const method = formatInterviewMethod(interview.interview_method);

  if (eventType === "INTERVIEW_SCHEDULED") {
    return {
      title: "Interview Scheduled",

      message: `Your interview for ${jobTitle} has been scheduled for ${interviewDate} at ${interviewTime} (${interview.timezone}) by ${method}.`,
    };
  }

  if (eventType === "INTERVIEW_CONFIRMED") {
    return {
      title: "Interview Confirmed",

      message: `Your interview for ${jobTitle} is confirmed for ${interviewDate} at ${interviewTime} (${interview.timezone}) by ${method}.`,
    };
  }

  if (eventType === "INTERVIEW_UPDATED") {
    return {
      title: "Interview Updated",

      message: `Your interview for ${jobTitle} has been updated. Please check the latest interview date, time and method.`,
    };
  }

  return {
    title: "Interview Cancelled",

    message: `Your interview for ${jobTitle} has been cancelled.`,
  };
};

// ======================================================
// ESCAPE HTML
// ======================================================

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

// ======================================================
// EMAIL TEXT
// ======================================================

const buildEmailText = ({
  title,
  seekerName,
  interview,
  vacancy,
  recruit,
  provider,
}) => {
  const { companyName, jobTitle } = getJobContext({
    vacancy,
    recruit,
    provider,
  });

  const interviewDate = formatInterviewDate(
    interview.interview_date,
    interview.timezone,
  );

  const method = formatInterviewMethod(interview.interview_method);

  const lines = [
    `Hello ${seekerName || "Candidate"},`,
    "",
    title,
    "",
    `Job: ${jobTitle}`,
    `Company: ${companyName}`,
    `Interview Date: ${interviewDate}`,
    `Interview Time: ${interview.interview_time}`,
    `Timezone: ${interview.timezone}`,
    `Interview Method: ${method}`,
  ];

  if (interview.meeting_link) {
    lines.push(`Meeting Link: ${interview.meeting_link}`);
  }

  if (interview.notes) {
    lines.push(`Notes: ${interview.notes}`);
  }

  lines.push(
    "",
    "Please check your Vision Career account for the latest interview information.",
  );

  return lines.join("\n");
};

// ======================================================
// EMAIL HTML
// ======================================================

const buildEmailHtml = ({
  title,
  seekerName,
  interview,
  vacancy,
  recruit,
  provider,
}) => {
  const { companyName, jobTitle } = getJobContext({
    vacancy,
    recruit,
    provider,
  });

  const interviewDate = formatInterviewDate(
    interview.interview_date,
    interview.timezone,
  );

  const method = formatInterviewMethod(interview.interview_method);

  const meetingLinkHtml = interview.meeting_link
    ? `
        <tr>
          <td style="padding:8px 12px;font-weight:600;">
            Meeting Link
          </td>
          <td style="padding:8px 12px;">
            <a
              href="${escapeHtml(interview.meeting_link)}"
              target="_blank"
              rel="noopener noreferrer"
            >
              ${escapeHtml(interview.meeting_link)}
            </a>
          </td>
        </tr>
      `
    : "";

  const notesHtml = interview.notes
    ? `
        <tr>
          <td style="padding:8px 12px;font-weight:600;">
            Notes
          </td>
          <td style="padding:8px 12px;">
            ${escapeHtml(interview.notes)}
          </td>
        </tr>
      `
    : "";

  return `
    <div
      style="
        font-family:Arial,Helvetica,sans-serif;
        line-height:1.6;
        color:#222222;
        max-width:650px;
        margin:0 auto;
      "
    >
      <h2>
        ${escapeHtml(title)}
      </h2>

      <p>
        Hello ${escapeHtml(seekerName || "Candidate")},
      </p>

      <p>
        Please find your interview information below.
      </p>

      <table
        style="
          width:100%;
          border-collapse:collapse;
          margin-top:20px;
        "
      >
        <tbody>
          <tr>
            <td style="padding:8px 12px;font-weight:600;">
              Job
            </td>
            <td style="padding:8px 12px;">
              ${escapeHtml(jobTitle)}
            </td>
          </tr>

          <tr>
            <td style="padding:8px 12px;font-weight:600;">
              Company
            </td>
            <td style="padding:8px 12px;">
              ${escapeHtml(companyName)}
            </td>
          </tr>

          <tr>
            <td style="padding:8px 12px;font-weight:600;">
              Interview Date
            </td>
            <td style="padding:8px 12px;">
              ${escapeHtml(interviewDate)}
            </td>
          </tr>

          <tr>
            <td style="padding:8px 12px;font-weight:600;">
              Interview Time
            </td>
            <td style="padding:8px 12px;">
              ${escapeHtml(interview.interview_time)}
            </td>
          </tr>

          <tr>
            <td style="padding:8px 12px;font-weight:600;">
              Timezone
            </td>
            <td style="padding:8px 12px;">
              ${escapeHtml(interview.timezone)}
            </td>
          </tr>

          <tr>
            <td style="padding:8px 12px;font-weight:600;">
              Interview Method
            </td>
            <td style="padding:8px 12px;">
              ${escapeHtml(method)}
            </td>
          </tr>

          ${meetingLinkHtml}
          ${notesHtml}
        </tbody>
      </table>

      <p style="margin-top:24px;">
        Please check your Vision Career account for the latest interview information.
      </p>
    </div>
  `;
};

// ======================================================
// SYSTEM NOTIFICATION
// ======================================================

const createSystemNotification = async ({
  seeker,
  interview,
  vacancy,
  recruit,
  provider,
  eventType,
  title,
  message,
}) => {
  const { companyName, jobTitle } = getJobContext({
    vacancy,
    recruit,
    provider,
  });

  return Notification.create({
    notification_id: generateNotificationId(),

    recipient_type: "seeker",

    recipient_id: seeker.seeker_id,

    type: eventType,

    title,

    message,

    interview: {
      interview_id: interview.interview_id,

      source_type: interview.source_type,

      application_id: interview.application_id || null,

      vacancy_id: interview.vacancy_id || null,

      placement_candidate_id: interview.placement_candidate_id || null,

      recruit_id: interview.recruit_id || null,

      company_name: companyName,

      job_title: jobTitle,

      interview_date: interview.interview_date,

      interview_time: interview.interview_time,

      timezone: interview.timezone,

      interview_method: interview.interview_method,

      meeting_link: interview.meeting_link || null,

      notes: interview.notes || null,
    },

    is_read: false,

    read_at: null,
  });
};

// ======================================================
// EMAIL
// ======================================================

const sendInterviewEmail = async ({
  seeker,
  interview,
  vacancy,
  recruit,
  provider,
  title,
}) => {
  if (!seeker.email) {
    return;
  }

  const subject = `Vision Career - ${title}`;

  const text = buildEmailText({
    title,
    seekerName: seeker.name,
    interview,
    vacancy,
    recruit,
    provider,
  });

  const html = buildEmailHtml({
    title,
    seekerName: seeker.name,
    interview,
    vacancy,
    recruit,
    provider,
  });

  await sendEmail({
    to: seeker.email,
    subject,
    text,
    html,
  });
};

// ======================================================
// NOTIFY SEEKER
// ======================================================

const notifySeekerAboutInterview = async ({
  interview,
  application = null,
  vacancy = null,
  recruit = null,
  provider = null,
  eventType,
}) => {
  if (!SUPPORTED_EVENTS.includes(eventType)) {
    throw new Error("Unsupported interview notification event.");
  }

  if (!interview) {
    throw new Error("Interview is required for notification.");
  }

  const seekerId = interview.seeker_id || application?.seeker_id;

  if (!seekerId) {
    throw new Error("Seeker information is missing.");
  }

  const seeker = await Seeker.findOne({
    seeker_id: seekerId,
  }).select("seeker_id name email");

  if (!seeker) {
    throw new Error("Seeker not found for interview notification.");
  }

  const { title, message } = buildNotificationContent({
    eventType,
    interview,
    vacancy,
    recruit,
    provider,
  });

  const notification = await createSystemNotification({
    seeker,
    interview,
    vacancy,
    recruit,
    provider,
    eventType,
    title,
    message,
  });

  try {
    await sendInterviewEmail({
      seeker,
      interview,
      vacancy,
      recruit,
      provider,
      title,
    });
  } catch (error) {
    console.error("INTERVIEW EMAIL ERROR:", error);
  }

  try {
    interview.notification_sent_at = new Date();

    await interview.save();
  } catch (error) {
    console.error("UPDATE INTERVIEW NOTIFICATION TIME ERROR:", error);
  }

  return {
    notification,
  };
};

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  notifySeekerAboutInterview,
};
