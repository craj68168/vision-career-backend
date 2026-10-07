const bcrypt = require("bcryptjs");

const jwt = require("jsonwebtoken");

const crypto = require("crypto");

const Seeker = require("../../models/seekers/seekerSchema");

const sendEmail = require("../../utils/send-email");

const { seekerMessage } = require("../../utils/seekerMessages");

// ======================================================

// GENERATE SEEKER ID

// ======================================================

const generateSeekerId = () => {
  return `SKR-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
};

// ======================================================

// GENERATE JWT TOKEN

// ======================================================

const generateToken = (seekerId) => {
  return jwt.sign(
    {
      seeker_id: seekerId,

      role: "seeker",
    },

    process.env.JWT_SECRET,

    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    },
  );
};

const t = (req, en, ja) => seekerMessage(req, { en, ja });

// ======================================================

// REGISTER SEEKER

// POST /api/seekers/auth/register

// ======================================================

exports.register = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // --------------------------------------------------

    // Check required fields

    // --------------------------------------------------

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        status: "error",

        message: t(
          req,
          "Name, email, phone number and password are required",
          "名前、メールアドレス、電話番号、パスワードは必須です",
        ),
      });
    }

    // --------------------------------------------------

    // Normalize email

    // --------------------------------------------------

    const normalizedEmail = email.trim().toLowerCase();

    // --------------------------------------------------

    // Validate email

    // --------------------------------------------------

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        status: "error",

        message: t(
          req,
          "Please enter a valid email address",
          "有効なメールアドレスを入力してください",
        ),
      });
    }

    // --------------------------------------------------

    // Validate phone

    // --------------------------------------------------

    const normalizedPhone = String(phone).trim();

    const phoneDigits = normalizedPhone.replace(/\D/g, "");

    const phoneFormatValid = /^[+\d\s()-]+$/.test(normalizedPhone);

    if (
      !phoneFormatValid ||
      phoneDigits.length < 7 ||
      phoneDigits.length > 15
    ) {
      return res.status(400).json({
        status: "error",

        message: t(
          req,
          "Please enter a valid phone number",
          "有効な電話番号を入力してください",
        ),
      });
    }

    // --------------------------------------------------

    // Validate password

    // --------------------------------------------------

    if (password.length < 8) {
      return res.status(400).json({
        status: "error",

        message: t(
          req,
          "Password must be at least 8 characters",
          "パスワードは8文字以上で入力してください",
        ),
      });
    }

    // --------------------------------------------------

    // Check if seeker already exists

    // --------------------------------------------------

    const existingSeeker = await Seeker.findOne({
      email: normalizedEmail,
    });

    if (existingSeeker) {
      return res.status(409).json({
        status: "error",

        message: t(
          req,
          "An account with this email already exists",
          "このメールアドレスのアカウントは既に存在します",
        ),
      });
    }

    // --------------------------------------------------

    // Hash password

    // --------------------------------------------------

    const salt = await bcrypt.genSalt(12);

    const hashedPassword = await bcrypt.hash(password, salt);

    // --------------------------------------------------

    // Generate custom seeker ID

    // --------------------------------------------------

    const seekerId = generateSeekerId();

    // --------------------------------------------------

    // Create seeker

    // --------------------------------------------------

    const seeker = await Seeker.create({
      seeker_id: seekerId,

      name: name.trim(),

      email: normalizedEmail,

      phone: normalizedPhone,

      password: hashedPassword,

      account_source: "self_registration",

      password_setup_required: false,

      approval_status: "pending",

      account_status: "inactive",
    });

    // --------------------------------------------------

    // Success response

    // --------------------------------------------------

    return res.status(201).json({
      status: "success",

      message: t(
        req,
        "Registration successful. Your account is pending admin approval.",
        "登録が完了しました。アカウントは管理者の承認待ちです。",
      ),

      user: {
        seeker_id: seeker.seeker_id,

        name: seeker.name,

        email: seeker.email,

        phone: seeker.phone,

        approval_status: seeker.approval_status,

        account_status: seeker.account_status,
      },
    });
  } catch (error) {
    console.error("Seeker registration error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        status: "error",

        message: t(
          req,
          "An account with this email or seeker ID already exists",
          "このメールアドレスまたは求職者IDのアカウントは既に存在します",
        ),
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        status: "error",

        message: t(
          req,
          "Please check your input and try again.",
          "入力内容を確認してもう一度お試しください。",
        ),
      });
    }

    return res.status(500).json({
      status: "error",

      message: t(
        req,
        "Failed to register seeker",
        "求職者の登録に失敗しました",
      ),
    });
  }
};

// ======================================================

// LOGIN SEEKER

// POST /api/seekers/auth/login

// ======================================================

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // --------------------------------------------------

    // Check required fields

    // --------------------------------------------------

    if (!email || !password) {
      return res.status(400).json({
        status: "error",

        message: t(
          req,
          "Email and password are required",
          "メールアドレスとパスワードは必須です",
        ),
      });
    }

    // --------------------------------------------------

    // Normalize email

    // --------------------------------------------------

    const normalizedEmail = email.trim().toLowerCase();

    // --------------------------------------------------

    // Find seeker

    // --------------------------------------------------

    const seeker = await Seeker.findOne({
      email: normalizedEmail,
    }).select("+password");

    // --------------------------------------------------

    // Invalid email

    // --------------------------------------------------

    if (!seeker) {
      return res.status(401).json({
        status: "error",

        message: t(
          req,
          "Invalid email or password",
          "メールアドレスまたはパスワードが正しくありません",
        ),
      });
    }

    // --------------------------------------------------

    // ADMIN-CREATED ACCOUNT REQUIRES PASSWORD SETUP

    // --------------------------------------------------

    if (seeker.password_setup_required) {
      return res.status(403).json({
        status: "password_setup_required",

        message: t(
          req,
          "Your account has been created. Please set your password using the link sent to your email.",
          "アカウントが作成されています。メールに送信されたリンクからパスワードを設定してください。",
        ),

        user: {
          seeker_id: seeker.seeker_id,

          name: seeker.name,

          email: seeker.email,
        },
      });
    }

    // --------------------------------------------------

    // Compare password

    // --------------------------------------------------

    const passwordMatches = await bcrypt.compare(
      password,

      seeker.password,
    );

    if (!passwordMatches) {
      return res.status(401).json({
        status: "error",

        message: t(
          req,
          "Invalid email or password",
          "メールアドレスまたはパスワードが正しくありません",
        ),
      });
    }

    // --------------------------------------------------

    // Pending approval

    // --------------------------------------------------

    if (seeker.approval_status === "pending") {
      return res.status(403).json({
        status: "pending_approval",

        message: t(
          req,
          "Your account is waiting for admin approval.",
          "アカウントは管理者の承認待ちです。",
        ),

        user: {
          seeker_id: seeker.seeker_id,

          name: seeker.name,

          email: seeker.email,

          approval_status: seeker.approval_status,

          account_status: seeker.account_status,
        },
      });
    }

    // --------------------------------------------------

    // Rejected account

    // --------------------------------------------------

    if (seeker.approval_status === "rejected") {
      return res.status(403).json({
        status: "rejected",

        message:
          seeker.rejection_reason ||
          t(
            req,
            "Your registration has been rejected.",
            "登録申請は却下されました。",
          ),
      });
    }

    // --------------------------------------------------

    // Suspended account

    // --------------------------------------------------

    if (seeker.account_status === "suspended") {
      return res.status(403).json({
        status: "suspended",

        message: t(
          req,
          "Your account has been suspended. Please contact support.",
          "アカウントは停止されています。サポートにお問い合わせください。",
        ),
      });
    }

    // --------------------------------------------------

    // Inactive account

    // --------------------------------------------------

    if (seeker.account_status !== "active") {
      return res.status(403).json({
        status: "inactive",

        message: t(
          req,
          "Your account is currently inactive.",
          "アカウントは現在無効です。",
        ),
      });
    }

    // --------------------------------------------------

    // Generate JWT token

    // --------------------------------------------------

    const token = generateToken(seeker.seeker_id);

    // --------------------------------------------------

    // Login success

    // --------------------------------------------------

    return res.status(200).json({
      status: "success",

      message: t(req, "Login successful", "ログインしました"),

      token,

      user: {
        seeker_id: seeker.seeker_id,

        name: seeker.name,

        email: seeker.email,

        approval_status: seeker.approval_status,

        account_status: seeker.account_status,
      },
    });
  } catch (error) {
    console.error("Seeker login error:", error);

    return res.status(500).json({
      status: "error",

      message: t(req, "Failed to login", "ログインに失敗しました"),
    });
  }
};

// ======================================================

// FORGOT PASSWORD

// POST /api/seekers/auth/forgot-password

// ======================================================

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        status: "error",

        message: t(req, "Email is required", "メールアドレスは必須です"),
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const seeker = await Seeker.findOne({
      email: normalizedEmail,
    }).select(
      "+password_reset_code_hash " +
        "+password_reset_code_expires " +
        "+password_reset_attempts",
    );

    // Don't reveal whether an email is registered

    if (!seeker) {
      return res.status(200).json({
        status: "success",

        message: t(
          req,
          "If this email is registered, a verification code has been sent.",
          "このメールアドレスが登録されている場合、確認コードを送信しました。",
        ),
      });
    }

    // Generate 6-digit code

    const code = crypto

      .randomInt(100000, 1000000)

      .toString();

    // Hash the code before saving

    const codeHash = crypto

      .createHash("sha256")

      .update(code)

      .digest("hex");

    seeker.password_reset_code_hash = codeHash;

    // Code valid for 10 minutes

    seeker.password_reset_code_expires = new Date(Date.now() + 10 * 60 * 1000);

    seeker.password_reset_attempts = 0;

    await seeker.save({
      validateBeforeSave: false,
    });

    // Send email

    await sendEmail({
      to: seeker.email,

      subject: "Password Reset Verification Code",

      text: `Your password reset verification code is ${code}. This code will expire in 10 minutes.`,

      html: `

        <h2>Password Reset</h2>



        <p>Your verification code is:</p>



        <h1>${code}</h1>



        <p>This code will expire in 10 minutes.</p>



        <p>If you did not request a password reset, please ignore this email.</p>

      `,
    });

    return res.status(200).json({
      status: "success",

      message: t(
        req,
        "If this email is registered, a verification code has been sent.",
        "このメールアドレスが登録されている場合、確認コードを送信しました。",
      ),
    });
  } catch (error) {
    console.error(
      "Forgot seeker password error:",

      error,
    );

    return res.status(500).json({
      status: "error",

      message: t(
        req,
        "Failed to process password reset request",
        "パスワードリセットの処理に失敗しました",
      ),
    });
  }
};

// ======================================================

// VERIFY PASSWORD RESET CODE

// POST /api/seekers/auth/verify-reset-code

// ======================================================

exports.verifyResetCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        status: "error",

        message: t(
          req,
          "Email and verification code are required",
          "メールアドレスと確認コードは必須です",
        ),
      });
    }

    const normalizedEmail = email

      .trim()

      .toLowerCase();

    const seeker = await Seeker.findOne({
      email: normalizedEmail,
    }).select(
      "+password_reset_code_hash " +
        "+password_reset_code_expires " +
        "+password_reset_attempts " +
        "+password_reset_token_hash " +
        "+password_reset_token_expires",
    );

    if (
      !seeker ||
      !seeker.password_reset_code_hash ||
      !seeker.password_reset_code_expires
    ) {
      return res.status(400).json({
        status: "error",

        message: t(
          req,
          "Invalid or expired verification code",
          "確認コードが無効または期限切れです",
        ),
      });
    }

    // Check expiry

    if (seeker.password_reset_code_expires < new Date()) {
      seeker.password_reset_code_hash = null;

      seeker.password_reset_code_expires = null;

      seeker.password_reset_attempts = 0;

      await seeker.save({
        validateBeforeSave: false,
      });

      return res.status(400).json({
        status: "error",

        message: t(
          req,
          "Verification code has expired",
          "確認コードの有効期限が切れています",
        ),
      });
    }

    // Maximum attempts

    if (seeker.password_reset_attempts >= 5) {
      return res.status(429).json({
        status: "error",

        message: t(
          req,
          "Too many incorrect attempts. Please request a new code.",
          "入力回数が上限を超えました。新しいコードをリクエストしてください。",
        ),
      });
    }

    const receivedCodeHash = crypto

      .createHash("sha256")

      .update(code.toString())

      .digest("hex");

    // Wrong code

    if (receivedCodeHash !== seeker.password_reset_code_hash) {
      seeker.password_reset_attempts += 1;

      await seeker.save({
        validateBeforeSave: false,
      });

      return res.status(400).json({
        status: "error",

        message: t(req, "Invalid verification code", "確認コードが正しくありません"),
      });
    }

    // --------------------------------------------------

    // Code correct

    // Create short-lived reset token

    // --------------------------------------------------

    const resetToken = crypto

      .randomBytes(32)

      .toString("hex");

    const resetTokenHash = crypto

      .createHash("sha256")

      .update(resetToken)

      .digest("hex");

    seeker.password_reset_token_hash = resetTokenHash;

    seeker.password_reset_token_expires = new Date(Date.now() + 10 * 60 * 1000);

    // Code can no longer be reused

    seeker.password_reset_code_hash = null;

    seeker.password_reset_code_expires = null;

    seeker.password_reset_attempts = 0;

    await seeker.save({
      validateBeforeSave: false,
    });

    return res.status(200).json({
      status: "success",

      message: t(req, "Verification successful", "確認が完了しました"),

      reset_token: resetToken,
    });
  } catch (error) {
    console.error(
      "Verify reset code error:",

      error,
    );

    return res.status(500).json({
      status: "error",

      message: t(
        req,
        "Failed to verify reset code",
        "リセットコードの確認に失敗しました",
      ),
    });
  }
};

// ======================================================

// RESET PASSWORD

// POST /api/seekers/auth/reset-password

// ======================================================

exports.resetPassword = async (req, res) => {
  try {
    const {
      reset_token,

      password,

      confirm_password,
    } = req.body;

    if (!reset_token || !password || !confirm_password) {
      return res.status(400).json({
        status: "error",

        message: t(
          req,
          "Reset token, password and confirm password are required",
          "リセットトークン、パスワード、確認用パスワードは必須です",
        ),
      });
    }

    if (password !== confirm_password) {
      return res.status(400).json({
        status: "error",

        message: t(req, "Passwords do not match", "パスワードが一致しません"),
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        status: "error",

        message: t(
          req,
          "Password must be at least 8 characters",
          "パスワードは8文字以上で入力してください",
        ),
      });
    }

    const resetTokenHash = crypto

      .createHash("sha256")

      .update(reset_token)

      .digest("hex");

    const seeker = await Seeker.findOne({
      password_reset_token_hash: resetTokenHash,

      password_reset_token_expires: {
        $gt: new Date(),
      },
    }).select(
      "+password " +
        "+password_reset_token_hash " +
        "+password_reset_token_expires",
    );

    if (!seeker) {
      return res.status(400).json({
        status: "error",

        message: t(
          req,
          "Reset session is invalid or has expired",
          "リセットセッションが無効または期限切れです",
        ),
      });
    }

    // Hash new password

    const salt = await bcrypt.genSalt(12);

    const hashedPassword = await bcrypt.hash(password, salt);

    const wasPasswordSetupRequired = Boolean(seeker.password_setup_required);

    seeker.password = hashedPassword;

    seeker.password_setup_required = false;

    // Invalidate reset token

    seeker.password_reset_token_hash = null;

    seeker.password_reset_token_expires = null;

    await seeker.save();

    return res.status(200).json({
      status: "success",

      message: wasPasswordSetupRequired
        ? t(
            req,
            "Password set successfully. You can now login to your account.",
            "パスワードを設定しました。アカウントにログインできます。",
          )
        : t(
            req,
            "Password reset successfully. Please login with your new password.",
            "パスワードをリセットしました。新しいパスワードでログインしてください。",
          ),
    });
  } catch (error) {
    console.error(
      "Reset seeker password error:",

      error,
    );

    return res.status(500).json({
      status: "error",

      message: t(
        req,
        "Failed to reset password",
        "パスワードのリセットに失敗しました",
      ),
    });
  }
};
