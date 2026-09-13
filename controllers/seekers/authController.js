const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const Seeker = require("../../models/seekers/seekerSchema");

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