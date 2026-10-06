const sendEmail = require("./send-email");

// ======================================================
// FRONTEND URL
// ======================================================

const getFrontendUrl = () => {
  const frontendUrl = process.env.FRONTEND_URL?.trim();

  if (!frontendUrl) {
    throw new Error("FRONTEND_URL is missing in environment variables.");
  }

  return frontendUrl.replace(/\/+$/, "");
};

// ======================================================
// ESCAPE HTML
// ======================================================

const escapeHtml = (value = "") => {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// ======================================================
// BUILD LOGIN URLS
// ======================================================

const getLoginUrls = () => {
  const frontendUrl = getFrontendUrl();

  return {
    ja: `${frontendUrl}/job-seekers-auth`,

    en: `${frontendUrl}/en/job-seekers-auth`,
  };
};

// ======================================================
// BUILD INITIAL PASSWORD SETUP URLS
// ======================================================

const getPasswordSetupUrls = (setupToken) => {
  const frontendUrl = getFrontendUrl();

  const encodedToken = encodeURIComponent(setupToken);

  return {
    ja:
      `${frontendUrl}/job-seekers-auth/forgot-password` +
      `?setup_token=${encodedToken}`,

    en:
      `${frontendUrl}/en/job-seekers-auth/forgot-password` +
      `?setup_token=${encodedToken}`,
  };
};

// ======================================================
// APPROVAL EMAIL
//
// Sent after a self-registered seeker is approved by
// Admin or an authorized Staff member.
// ======================================================

const sendSeekerApprovalEmail = async (seeker) => {
  if (!seeker?.email) {
    throw new Error("Seeker email is required.");
  }

  const name = escapeHtml(seeker.name || "Job Seeker");

  const loginUrls = getLoginUrls();

  await sendEmail({
    to: seeker.email,

    subject: "Vision Career - Your account has been approved",

    text: `
Hello ${seeker.name || "Job Seeker"},

Your Vision Career account has been approved.

You can now sign in to your account.

English Login:
${loginUrls.en}

Japanese Login:
${loginUrls.ja}

Please complete your profile before applying for job opportunities.

Vision Career
    `.trim(),

    html: `
      <div
        style="
          max-width: 620px;
          margin: 0 auto;
          padding: 32px;
          font-family: Arial, Helvetica, sans-serif;
          color: #1e293b;
          line-height: 1.6;
        "
      >
        <h2
          style="
            margin: 0 0 20px;
            color: #0f766e;
          "
        >
          Vision Career
        </h2>

        <h3
          style="
            margin: 0 0 16px;
            color: #0f172a;
          "
        >
          Your account has been approved
        </h3>

        <p>
          Hello ${name},
        </p>

        <p>
          Your Vision Career account has been approved.
          You can now sign in to your account.
        </p>

        <p>
          Please complete your profile before applying
          for job opportunities.
        </p>

        <div style="margin: 28px 0;">
          <a
            href="${loginUrls.en}"
            style="
              display: inline-block;
              padding: 12px 20px;
              margin-right: 8px;
              margin-bottom: 8px;
              background: #0f766e;
              color: #ffffff;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
            "
          >
            Sign in - English
          </a>

          <a
            href="${loginUrls.ja}"
            style="
              display: inline-block;
              padding: 12px 20px;
              margin-bottom: 8px;
              background: #0f172a;
              color: #ffffff;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
            "
          >
            ログイン - 日本語
          </a>
        </div>

        <hr
          style="
            border: 0;
            border-top: 1px solid #e2e8f0;
            margin: 32px 0;
          "
        />

        <h3
          style="
            margin: 0 0 16px;
            color: #0f172a;
          "
        >
          アカウントが承認されました
        </h3>

        <p>
          ${name} 様
        </p>

        <p>
          Vision Career のアカウントが承認されました。
          ログインしてご利用いただけます。
        </p>

        <p>
          求人へ応募する前にプロフィール情報を
          完成させてください。
        </p>

        <p
          style="
            margin-top: 32px;
            color: #64748b;
            font-size: 13px;
          "
        >
          Vision Career
        </p>
      </div>
    `,
  });
};

// ======================================================
// ADMIN CREATED ACCOUNT EMAIL
//
// The seeker has no known password.
// They receive a secure initial password setup link.
// ======================================================

const sendSeekerAccountCreatedEmail = async ({
  seeker,
  setupToken,
  expiresMinutes = 60,
}) => {
  if (!seeker?.email) {
    throw new Error("Seeker email is required.");
  }

  if (!setupToken) {
    throw new Error("Password setup token is required.");
  }

  const name = escapeHtml(seeker.name || "Job Seeker");

  const setupUrls = getPasswordSetupUrls(setupToken);

  await sendEmail({
    to: seeker.email,

    subject: "Vision Career - Your account has been created",

    text: `
Hello ${seeker.name || "Job Seeker"},

A Vision Career account has been created for you.

Please create your password using one of the secure links below.

English:
${setupUrls.en}

Japanese:
${setupUrls.ja}

This password setup link expires in ${expiresMinutes} minutes.

If the link expires, you can use the Forgot Password function from the Vision Career login page.

Vision Career
      `.trim(),

    html: `
        <div
          style="
            max-width: 620px;
            margin: 0 auto;
            padding: 32px;
            font-family: Arial, Helvetica, sans-serif;
            color: #1e293b;
            line-height: 1.6;
          "
        >
          <h2
            style="
              margin: 0 0 20px;
              color: #0f766e;
            "
          >
            Vision Career
          </h2>

          <h3
            style="
              margin: 0 0 16px;
              color: #0f172a;
            "
          >
            Your account has been created
          </h3>

          <p>
            Hello ${name},
          </p>

          <p>
            A Vision Career account has been created
            for you by our administration team.
          </p>

          <p>
            For security, no password has been provided
            by the administrator.
            Please create your own password using the
            secure link below.
          </p>

          <div style="margin: 28px 0;">
            <a
              href="${setupUrls.en}"
              style="
                display: inline-block;
                padding: 12px 20px;
                margin-right: 8px;
                margin-bottom: 8px;
                background: #0f766e;
                color: #ffffff;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
              "
            >
              Set Password - English
            </a>

            <a
              href="${setupUrls.ja}"
              style="
                display: inline-block;
                padding: 12px 20px;
                margin-bottom: 8px;
                background: #0f172a;
                color: #ffffff;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
              "
            >
              パスワードを設定 - 日本語
            </a>
          </div>

          <p
            style="
              color: #64748b;
              font-size: 14px;
            "
          >
            This link expires in
            ${expiresMinutes} minutes.
          </p>

          <p
            style="
              color: #64748b;
              font-size: 14px;
            "
          >
            If the link expires, use the
            Forgot Password option from the login page.
          </p>

          <hr
            style="
              border: 0;
              border-top: 1px solid #e2e8f0;
              margin: 32px 0;
            "
          />

          <h3
            style="
              margin: 0 0 16px;
              color: #0f172a;
            "
          >
            アカウントが作成されました
          </h3>

          <p>
            ${name} 様
          </p>

          <p>
            Vision Career のアカウントが
            管理者によって作成されました。
          </p>

          <p>
            セキュリティのため管理者は
            パスワードを設定していません。
            上記リンクからご自身の
            パスワードを設定してください。
          </p>

          <p
            style="
              margin-top: 32px;
              color: #64748b;
              font-size: 13px;
            "
          >
            Vision Career
          </p>
        </div>
      `,
  });
};

module.exports = {
  sendSeekerApprovalEmail,

  sendSeekerAccountCreatedEmail,
};
