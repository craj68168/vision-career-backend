const jwt = require("jsonwebtoken");

const Register = require("../models/providers/registerSchema");

// ======================================================
// PROVIDER AUTHENTICATION MIDDLEWARE
// ======================================================
//
// Expected Authorization header:
//
// Authorization: Bearer <token>
//
// Expected provider JWT:
//
// {
//   registerId: "r-000001",
//   role: "provider"
// }
//
// After successful authentication:
//
// req.registerId = "r-000001"
// req.user = {
//   registerId: "r-000001",
//   role: "provider"
// }
//
// ======================================================

const authMiddleware = async (req, res, next) => {
  try {
    // ==================================================
    // AUTHORIZATION HEADER
    // ==================================================

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        status: "error",

        message: "Provider authentication required.",
      });
    }

    // ==================================================
    // TOKEN
    // ==================================================

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        status: "error",

        message: "Authentication token is missing.",
      });
    }

    // ==================================================
    // JWT SECRET
    // ==================================================

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing in .env");

      return res.status(500).json({
        status: "error",

        message: "Authentication configuration error.",
      });
    }

    // ==================================================
    // VERIFY TOKEN
    // ==================================================

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ==================================================
    // PROVIDER ROLE
    // ==================================================

    if (decoded.role && decoded.role !== "provider") {
      return res.status(403).json({
        status: "error",

        message: "Provider access only.",
      });
    }

    // ==================================================
    // REGISTER ID
    // ==================================================

    const registerId = decoded.registerId || decoded.register_id;

    if (!registerId) {
      return res.status(401).json({
        status: "error",

        message: "Invalid provider token.",
      });
    }

    // ==================================================
    // CONFIRM PROVIDER EXISTS
    // ==================================================

    const provider = await Register.findOne({
      registerId,
    });

    if (!provider) {
      return res.status(401).json({
        status: "error",

        message: "Provider account not found.",
      });
    }

    // ==================================================
    // ATTACH PROVIDER TO REQUEST
    // ==================================================

    req.registerId = registerId;

    req.user = {
      registerId,

      role: "provider",
    };

    // ==================================================
    // CONTINUE
    // ==================================================

    return next();
  } catch (error) {
    console.error("Provider authentication error:", error);

    // ==================================================
    // EXPIRED JWT
    // ==================================================

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        status: "error",

        message: "Your session has expired. Please log in again.",
      });
    }

    // ==================================================
    // INVALID JWT
    // ==================================================

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        status: "error",

        message: "Invalid authentication token.",
      });
    }

    return res.status(500).json({
      status: "error",

      message: "Provider authentication failed.",
    });
  }
};

module.exports = authMiddleware;
