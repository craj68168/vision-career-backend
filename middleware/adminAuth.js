const jwt = require("jsonwebtoken");

const Admin = require("../models/admin/adminSchema");

// ======================================================
// ADMIN AUTH MIDDLEWARE
// ======================================================

const adminAuth = async (req, res, next) => {
  try {
    // ==================================================
    // READ AUTHORIZATION HEADER
    // ==================================================

    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // ==================================================
    // EXTRACT TOKEN
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
    // VERIFY TOKEN
    // ==================================================

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ==================================================
    // CHECK ROLE
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
    // CHECK ACCOUNT STATUS
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
    // ATTACH ADMIN TO REQUEST
    // ==================================================

    req.admin = {
      adminId: admin.adminId,
      username: admin.username,
      role: admin.role,
    };

    next();
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
