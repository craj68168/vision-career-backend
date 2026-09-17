const jwt = require("jsonwebtoken");
const Seeker = require("../models/seekers/seekerSchema");

// ======================================================
// SEEKER AUTHENTICATION
// ======================================================

const seekerAuth = async (req, res, next) => {
  try {
    // --------------------------------------------------
    // Get Authorization header
    // --------------------------------------------------

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        status: "error",
        message: "Authorization token is required",
      });
    }

    // --------------------------------------------------
    // Extract token
    // --------------------------------------------------

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        status: "error",
        message: "Authorization token is required",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing in .env");

      return res.status(500).json({
        status: "error",
        message: "Authentication configuration error.",
      });
    }
    // --------------------------------------------------
    // Verify JWT
    // --------------------------------------------------

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // --------------------------------------------------
    // Check role
    // --------------------------------------------------

    if (decoded.role !== "seeker" || !decoded.seeker_id) {
      return res.status(403).json({
        status: "error",
        message: "Access denied",
      });
    }

    // --------------------------------------------------
    // Find current seeker
    // --------------------------------------------------

    const seeker = await Seeker.findOne({
      seeker_id: decoded.seeker_id,
    }).select("seeker_id name email approval_status account_status");

    if (!seeker) {
      return res.status(401).json({
        status: "error",
        message: "Seeker account no longer exists",
      });
    }

    // --------------------------------------------------
    // Check approval
    // --------------------------------------------------

    if (seeker.approval_status === "pending") {
      return res.status(403).json({
        status: "pending_approval",
        message: "Your account is waiting for admin approval.",
      });
    }

    if (seeker.approval_status === "rejected") {
      return res.status(403).json({
        status: "rejected",
        message: "Your account has been rejected.",
      });
    }

    // --------------------------------------------------
    // Check account status
    // --------------------------------------------------

    if (seeker.account_status === "suspended") {
      return res.status(403).json({
        status: "suspended",
        message: "Your account has been suspended. Please contact support.",
      });
    }

    if (seeker.account_status !== "active") {
      return res.status(403).json({
        status: "inactive",
        message: "Your account is currently inactive.",
      });
    }

    // --------------------------------------------------
    // Attach authenticated seeker
    // --------------------------------------------------

    req.user = {
      seeker_id: seeker.seeker_id,
      role: "seeker",
    };

    next();
  } catch (error) {
    console.error("Seeker authentication error:", error);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        status: "error",
        message: "Token has expired",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        status: "error",
        message: "Invalid token",
      });
    }

    return res.status(500).json({
      status: "error",
      message: "Authentication failed",
    });
  }
};

module.exports = seekerAuth;
