const crypto = require("crypto");

const Notification = require("../models/notifications/notificationSchema");

const Seeker = require("../models/seekers/seekerSchema");

const sendEmail = require("../utils/send-email");

// ======================================================
// SUPPORTED EVENTS
// ======================================================

const SUPPORTED_EVENTS = [
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_CONFIRMED",
  "INTERVIEW_UPDATED",
  "INTERVIEW_CANCELLED",
];

// ======================================================
// GENERATE NOTIFICATION ID
//
// Example:
//
// NTF-A12B34CD
//
// ======================================================

const generateNotificationId = () => {
  return `NTF-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
};

// ======================================================
// SAFE STRING
// ======================================================

const safeString = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

// ======================================================
// FORMAT INTERVIEW METHOD
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
// FORMAT DATE
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
// BUILD NOTIFICATION CONTENT
// ======================================================

const buildNotificationContent = ({ eventType, interview, vacancy }) => {
  const companyName = safeString(vacancy?.companyName) || "Company";

  const jobTitle = safeString(vacancy?.title) || "Job";

  const interviewDate = formatInterviewDate(
    interview.interview_date,
    interview.timezone,
  );

  const interviewTime = interview.interview_time || "";

  const method = formatInterviewMethod(interview.interview_method);

  // ==================================================
  // SCHEDULED
  // ==================================================

  if (eventType === "INTERVIEW_SCHEDULED") {
    return {
      title: "Interview Scheduled",

      message: `Your interview for ${jobTitle} at ${companyName} has been scheduled for ${interviewDate} at ${interviewTime} (${interview.timezone}).`,
    };
  }

  // ==================================================
  // CONFIRMED
  // ==================================================

  if (eventType === "INTERVIEW_CONFIRMED") {
    return {
      title: "Interview Confirmed",

      message: `Your interview for ${jobTitle} at ${companyName} is confirmed for ${interviewDate} at ${interviewTime} (${interview.timezone}) by ${method}.`,
    };
  }

  // ==================================================
  // UPDATED
  // ==================================================

  if (eventType === "INTERVIEW_UPDATED") {
    return {
      title: "Interview Updated",

      message: `Your interview for ${jobTitle} at ${companyName} has been updated. Please check the latest interview date, time and method.`,
    };
  }

  // ==================================================
  // CANCELLED
  // ==================================================

  return {
    title: "Interview Cancelled",

    message: `Your interview for ${jobTitle} at ${companyName} has been cancelled.`,
  };
};

// ======================================================
// BUILD EMAIL TEXT
// ======================================================

const buildEmailText = ({ title, seekerName, interview, vacancy }) => {
  const companyName = safeString(vacancy?.companyName) || "Not specified";

  const jobTitle = safeString(vacancy?.title) || "Not specified";

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
// ESCAPE HTML
// ======================================================

const escapeHtml = (value) => {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

// ======================================================
// BUILD EMAIL HTML
// ======================================================

const buildEmailHtml = ({ title, seekerName, interview, vacancy }) => {
  const companyName = safeString(vacancy?.companyName) || "Not specified";

  const jobTitle = safeString(vacancy?.title) || "Not specified";

  const interviewDate = formatInterviewDate(
    interview.interview_date,
    interview.timezone,
  );

  const method = formatInterviewMethod(interview.interview_method);

  const meetingLinkHtml = interview.meeting_link
    ? `
        <tr>
          <td style="padding:8px 12px;font-weight:600;">Meeting Link</td>
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
          <td style="padding:8px 12px;font-weight:600;">Notes</td>
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
            <td style="padding:8px 12px;font-weight:600;">Job</td>
            <td style="padding:8px 12px;">
              ${escapeHtml(jobTitle)}
            </td>
          </tr>

          <tr>
            <td style="padding:8px 12px;font-weight:600;">Company</td>
            <td style="padding:8px 12px;">
              ${escapeHtml(companyName)}
            </td>
          </tr>

          <tr>
            <td style="padding:8px 12px;font-weight:600;">Interview Date</td>
            <td style="padding:8px 12px;">
              ${escapeHtml(interviewDate)}
            </td>
          </tr>

          <tr>
            <td style="padding:8px 12px;font-weight:600;">Interview Time</td>
            <td style="padding:8px 12px;">
              ${escapeHtml(interview.interview_time)}
            </td>
          </tr>

          <tr>
            <td style="padding:8px 12px;font-weight:600;">Timezone</td>
            <td style="padding:8px 12px;">
              ${escapeHtml(interview.timezone)}
            </td>
          </tr>

          <tr>
            <td style="padding:8px 12px;font-weight:600;">Interview Method</td>
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
// CREATE SYSTEM NOTIFICATION
// ======================================================

const createSystemNotification = async ({
  seeker,
  interview,
  vacancy,
  eventType,
  title,
  message,
}) => {
  return Notification.create({
    notification_id: generateNotificationId(),

    recipient_type: "seeker",

    recipient_id: seeker.seeker_id,

    type: eventType,

    title,

    message,

    interview: {
      interview_id: interview.interview_id,

      application_id: interview.application_id,

      vacancy_id: interview.vacancy_id,

      company_name: vacancy?.companyName || null,

      job_title: vacancy?.title || null,

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
// SEND INTERVIEW EMAIL
// ======================================================

const sendInterviewEmail = async ({ seeker, interview, vacancy, title }) => {
  if (!seeker.email) {
    return;
  }

  const subject = `Vision Career - ${title}`;

  const text = buildEmailText({
    title,

    seekerName: seeker.name,

    interview,

    vacancy,
  });

  const html = buildEmailHtml({
    title,

    seekerName: seeker.name,

    interview,

    vacancy,
  });

  await sendEmail({
    to: seeker.email,

    subject,

    text,

    html,
  });
};

// ======================================================
// NOTIFY SEEKER ABOUT INTERVIEW
// ======================================================
//
// This creates:
//
// 1. System notification
// 2. Email notification
//
// Email failure does NOT remove the already-created
// system notification.
//
// ======================================================

const notifySeekerAboutInterview = async ({
  interview,
  application,
  vacancy,
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

  // ==================================================
  // FIND SEEKER
  // ==================================================

  const seeker = await Seeker.findOne({
    seeker_id: seekerId,
  }).select("seeker_id name email");

  if (!seeker) {
    throw new Error("Seeker not found for interview notification.");
  }

  // ==================================================
  // CONTENT
  // ==================================================

  const { title, message } = buildNotificationContent({
    eventType,
    interview,
    vacancy,
  });

  // ==================================================
  // SYSTEM NOTIFICATION
  // ==================================================

  const notification = await createSystemNotification({
    seeker,
    interview,
    vacancy,
    eventType,
    title,
    message,
  });

  // ==================================================
  // EMAIL
  // ==================================================

  try {
    await sendInterviewEmail({
      seeker,
      interview,
      vacancy,
      title,
    });
  } catch (error) {
    console.error("INTERVIEW EMAIL ERROR:", error);
  }

  // ==================================================
  // UPDATE INTERVIEW NOTIFICATION TIME
  // ==================================================

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
