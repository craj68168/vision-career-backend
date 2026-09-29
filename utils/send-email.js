const { Resend } = require("resend");

// ======================================================
// RESEND CLIENT
// ======================================================

if (!process.env.RESEND_API_KEY) {
  console.warn("⚠️ RESEND_API_KEY is missing. Email sending will fail.");
}

const resend = new Resend(process.env.RESEND_API_KEY);

// ======================================================
// SEND EMAIL
// ======================================================

const sendEmail = async ({ to, subject, text, html }) => {
  if (!to) {
    throw new Error("Email recipient is required.");
  }

  if (!subject) {
    throw new Error("Email subject is required.");
  }

  if (!process.env.EMAIL_FROM) {
    throw new Error("EMAIL_FROM is missing in environment variables.");
  }

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: Array.isArray(to) ? to : [to],
    subject,
    ...(text ? { text } : {}),
    ...(html ? { html } : {}),
  });

  if (error) {
    console.error("RESEND EMAIL ERROR:", error);

    throw new Error(error.message || "Failed to send email through Resend.");
  }

  console.log("✅ Email sent through Resend:", {
    emailId: data?.id,
    to,
    subject,
  });

  return data;
};

module.exports = sendEmail;
