const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Seeker = require("../../models/seekers/seekerSchema");

// ======================================================
// GENERATE JWT TOKEN
// ======================================================

const generateToken = (seekerId) => {
  return jwt.sign(
    {
      id: seekerId,
      role: "seeker",
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    }
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

    const hashedPassword = await bcrypt.hash(
      password,
      salt
    );

    // --------------------------------------------------
    // Create seeker
    // --------------------------------------------------

    const seeker = await Seeker.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,

      // New seekers require admin approval
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
        id: seeker._id,
        name: seeker.name,
        email: seeker.email,
        approval_status: seeker.approval_status,
        account_status: seeker.account_status,
      },
    });
  } catch (error) {
    console.error(
      "Seeker registration error:",
      error
    );

    // Duplicate MongoDB unique field error
    if (error.code === 11000) {
      return res.status(409).json({
        status: "error",
        message:
          "An account with this email already exists",
      });
    }

    // Mongoose validation error
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
    //
    // password has select:false in seekerSchema.js,
    // therefore we explicitly include it here.
    // --------------------------------------------------

    const seeker = await Seeker.findOne({
      email: normalizedEmail,
    }).select("+password");

    // --------------------------------------------------
    // Email doesn't exist
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
      seeker.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        status: "error",
        message: "Invalid email or password",
      });
    }

    // --------------------------------------------------
    // Check approval status
    // --------------------------------------------------

    if (seeker.approval_status === "pending") {
      return res.status(403).json({
        status: "pending_approval",

        message:
          "Your account is waiting for admin approval.",

        user: {
          id: seeker._id,
          name: seeker.name,
          email: seeker.email,
          approval_status:
            seeker.approval_status,
          account_status:
            seeker.account_status,
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

    const token = generateToken(
      seeker._id.toString()
    );

    // --------------------------------------------------
    // Login success
    // --------------------------------------------------

    return res.status(200).json({
      status: "success",
      message: "Login successful",

      token,

      user: {
        id: seeker._id,
        name: seeker.name,
        email: seeker.email,
        approval_status:
          seeker.approval_status,
        account_status:
          seeker.account_status,
      },
    });
  } catch (error) {
    console.error(
      "Seeker login error:",
      error
    );

    return res.status(500).json({
      status: "error",
      message: "Failed to login",
    });
  }
};