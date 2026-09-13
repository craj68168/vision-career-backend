const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Provider = require("../../models/providers/providerSchema");

const generateToken = (provider) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    {
      providerId: provider.providerId,
      role: "provider",
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    },
  );
};

exports.register = async (req, res) => {
  try {
    const { name, companyName, email, password, phone, address } = req.body;

    if (!name || !companyName || !email || !password) {
      return res.status(400).json({
        status: "error",
        message: "Name, company name, email, and password are required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        status: "error",
        message: "Password must contain at least 8 characters.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingProvider = await Provider.findOne({
      email: normalizedEmail,
    });

    if (existingProvider) {
      return res.status(409).json({
        status: "error",
        message: "A provider with this email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const provider = await Provider.create({
      name,
      companyName,
      email: normalizedEmail,
      password: hashedPassword,
      phone,
      address,
    });

    return res.status(201).json({
      status: "success",
      message:
        "Registration successful. Your account is pending admin approval.",
      provider: provider.toJSON(),
    });
  } catch (error) {
    if (error.code === 11000) {
      const duplicatedField = Object.keys(error.keyPattern || {})[0];

      return res.status(409).json({
        status: "error",
        message: `${duplicatedField || "Provider"} already exists.`,
      });
    }

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map(
        (validationError) => validationError.message,
      );

      return res.status(400).json({
        status: "error",
        message: "Validation failed.",
        errors,
      });
    }

    console.error("Provider registration error:", error);

    return res.status(500).json({
      status: "error",
      message: "Unable to register provider.",
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: "error",
        message: "Email and password are required.",
      });
    }

    const provider = await Provider.findOne({
      email: email.trim().toLowerCase(),
    }).select("+password");

    if (!provider) {
      return res.status(401).json({
        status: "error",
        message: "Invalid email or password.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      provider.password,
    );

    if (!passwordMatches) {
      return res.status(401).json({
        status: "error",
        message: "Invalid email or password.",
      });
    }

    if (provider.approval_status === "pending") {
      return res.status(403).json({
        status: "pending_approval",
        message: "Your account is waiting for admin approval.",
        providerId: provider.providerId,
      });
    }

    if (provider.approval_status === "rejected") {
      return res.status(403).json({
        status: "rejected",
        message: "Your provider registration was rejected.",
        rejection_reason: provider.rejection_reason,
      });
    }

    if (provider.account_status === "suspended") {
      return res.status(403).json({
        status: "suspended",
        message: "Your provider account has been suspended.",
      });
    }

    if (provider.account_status !== "active") {
      return res.status(403).json({
        status: "inactive",
        message: "Your provider account is inactive.",
      });
    }

    const token = generateToken(provider);

    provider.password = undefined;

    return res.status(200).json({
      status: "success",
      message: "Login successful.",
      token,
      provider,
    });
  } catch (error) {
    console.error("Provider login error:", error);

    return res.status(500).json({
      status: "error",
      message: "Unable to log in.",
    });
  }
};