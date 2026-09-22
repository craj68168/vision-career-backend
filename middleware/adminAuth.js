const jwt = require("jsonwebtoken");

const Admin = require("../models/admin/adminSchema");

// ======================================================
// ADMIN AUTH MIDDLEWARE
// ======================================================

const adminAuth = async (req, res, next) => {
  try {
    // ==================================================
    // AUTHORIZATION HEADER
    // ==================================================

    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,

        message: "Authentication required.",
      });
    }

    // ==================================================
    // TOKEN
    // ==================================================

    const token = authorization.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,

        message: "Authentication token missing.",
      });
    }

    // ==================================================
    // JWT SECRET
    // ==================================================

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET missing in .env");
    }

    // ==================================================
    // VERIFY
    // ==================================================

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ==================================================
    // ROLE
    // ==================================================

    if (decoded.role !== "admin" || !decoded.adminId) {
      return res.status(403).json({
        success: false,

        message: "Admin access required.",
      });
    }

    // ==================================================
    // FIND ADMIN
    // ==================================================

    const admin = await Admin.findOne({
      adminId: decoded.adminId,
    });

    if (!admin) {
      return res.status(401).json({
        success: false,

        message: "Admin account not found.",
      });
    }

    // ==================================================
    // STATUS
    // ==================================================

    if (admin.status !== "active") {
      return res.status(403).json({
        success: false,

        message:
          admin.status === "suspended"
            ? "Admin account is suspended."
            : "Admin account is inactive.",
      });
    }

    // ==================================================
    // PASSWORD CHANGE TOKEN INVALIDATION
    //
    // JWT iat is stored in seconds.
    // ==================================================

    if (admin.passwordChangedAt && decoded.iat) {
      const passwordChangedAtSeconds = Math.floor(
        admin.passwordChangedAt.getTime() / 1000,
      );

      if (decoded.iat < passwordChangedAtSeconds) {
        return res.status(401).json({
          success: false,

          message: "Your password has changed. Please login again.",
        });
      }
    }

    // ==================================================
    // ATTACH ADMIN
    // ==================================================

    req.admin = {
      adminId: admin.adminId,

      username: admin.username,

      role: admin.role,
    };

    return next();
  } catch (error) {
    console.error("ADMIN AUTH ERROR:", error);

    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        success: false,

        message: "Invalid or expired authentication token.",
      });
    }

    return res.status(500).json({
      success: false,

      message: "Authentication failed.",
    });
  }
};

module.exports = adminAuth;
