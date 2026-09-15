const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const Seeker = require("../../models/seekers/seekerSchema");

const sendEmail = require("../../utils/send-email");
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

// ======================================================
// REGISTER SEEKER
// POST /api/seekers/auth/register
// ======================================================

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // --------------------------------------------------
    // Check required fields
    // --------------------------------------------------

    if (!name || !email || !password) {
      return res.status(400).json({
        status: "error",
        message: "Name, email and password are required",
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
        message: "Please enter a valid email address",
      });
    }

    // --------------------------------------------------
    // Validate password
    // --------------------------------------------------

    if (password.length < 8) {
      return res.status(400).json({
        status: "error",
        message: "Password must be at least 8 characters",
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
        message: "An account with this email already exists",
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
      password: hashedPassword,

      approval_status: "pending",
      account_status: "inactive",
    });

    // --------------------------------------------------
    // Success response
    // --------------------------------------------------

    return res.status(201).json({
      status: "success",

      message:
        "Registration successful. Your account is pending admin approval.",

      user: {
        seeker_id: seeker.seeker_id,
        name: seeker.name,
        email: seeker.email,
        approval_status: seeker.approval_status,
        account_status: seeker.account_status,
      },
    });
  } catch (error) {
    console.error("Seeker registration error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        status: "error",
        message: "An account with this email or seeker ID already exists",
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
      message: "Failed to register seeker",
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
        message: "Email and password are required",
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
        message: "Invalid email or password",
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
        message: "Invalid email or password",
      });
    }

    // --------------------------------------------------
    // Pending approval
    // --------------------------------------------------

    if (seeker.approval_status === "pending") {
      return res.status(403).json({
        status: "pending_approval",

        message:
          "Your account is waiting for admin approval.",

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
          "Your registration has been rejected.",
      });
    }

    // --------------------------------------------------
    // Suspended account
    // --------------------------------------------------

    if (seeker.account_status === "suspended") {
      return res.status(403).json({
        status: "suspended",

        message:
          "Your account has been suspended. Please contact support.",
      });
    }

    // --------------------------------------------------
    // Inactive account
    // --------------------------------------------------

    if (seeker.account_status !== "active") {
      return res.status(403).json({
        status: "inactive",

        message:
          "Your account is currently inactive.",
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
      message: "Login successful",

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
      message: "Failed to login",
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
        message: "Email is required",
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
        message:
          "If this email is registered, a verification code has been sent.",
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
    seeker.password_reset_code_expires =
      new Date(Date.now() + 10 * 60 * 1000);

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
      message:
        "If this email is registered, a verification code has been sent.",
    });
  } catch (error) {
    console.error(
      "Forgot seeker password error:",
      error,
    );

    return res.status(500).json({
      status: "error",
      message:
        "Failed to process password reset request",
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
        message:
          "Email and verification code are required",
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
        message:
          "Invalid or expired verification code",
      });
    }

    // Check expiry
    if (
      seeker.password_reset_code_expires <
      new Date()
    ) {
      seeker.password_reset_code_hash = null;
      seeker.password_reset_code_expires = null;
      seeker.password_reset_attempts = 0;

      await seeker.save({
        validateBeforeSave: false,
      });

      return res.status(400).json({
        status: "error",
        message:
          "Verification code has expired",
      });
    }

    // Maximum attempts
    if (seeker.password_reset_attempts >= 5) {
      return res.status(429).json({
        status: "error",
        message:
          "Too many incorrect attempts. Please request a new code.",
      });
    }

    const receivedCodeHash = crypto
      .createHash("sha256")
      .update(code.toString())
      .digest("hex");

    // Wrong code
    if (
      receivedCodeHash !==
      seeker.password_reset_code_hash
    ) {
      seeker.password_reset_attempts += 1;

      await seeker.save({
        validateBeforeSave: false,
      });

      return res.status(400).json({
        status: "error",
        message:
          "Invalid verification code",
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

    seeker.password_reset_token_hash =
      resetTokenHash;

    seeker.password_reset_token_expires =
      new Date(Date.now() + 10 * 60 * 1000);

    // Code can no longer be reused
    seeker.password_reset_code_hash = null;
    seeker.password_reset_code_expires = null;
    seeker.password_reset_attempts = 0;

    await seeker.save({
      validateBeforeSave: false,
    });

    return res.status(200).json({
      status: "success",
      message:
        "Verification successful",

      reset_token: resetToken,
    });
  } catch (error) {
    console.error(
      "Verify reset code error:",
      error,
    );

    return res.status(500).json({
      status: "error",
      message:
        "Failed to verify reset code",
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

    if (
      !reset_token ||
      !password ||
      !confirm_password
    ) {
      return res.status(400).json({
        status: "error",
        message:
          "Reset token, password and confirm password are required",
      });
    }

    if (password !== confirm_password) {
      return res.status(400).json({
        status: "error",
        message:
          "Passwords do not match",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        status: "error",
        message:
          "Password must be at least 8 characters",
      });
    }

    const resetTokenHash = crypto
      .createHash("sha256")
      .update(reset_token)
      .digest("hex");

    const seeker = await Seeker.findOne({
      password_reset_token_hash:
        resetTokenHash,

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
        message:
          "Reset session is invalid or has expired",
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);

    const hashedPassword =
      await bcrypt.hash(password, salt);

    seeker.password = hashedPassword;

    // Invalidate reset token
    seeker.password_reset_token_hash = null;
    seeker.password_reset_token_expires = null;

    await seeker.save();

    return res.status(200).json({
      status: "success",
      message:
        "Password reset successfully. Please login with your new password.",
    });
  } catch (error) {
    console.error(
      "Reset seeker password error:",
      error,
    );

    return res.status(500).json({
      status: "error",
      message:
        "Failed to reset password", 
    });
  }
};