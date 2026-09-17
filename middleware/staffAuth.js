const jwt = require("jsonwebtoken");

const Staff = require("../models/admin/staffSchema");

// ======================================================
// STAFF AUTH
// ======================================================

const staffAuth = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,

        message: "Staff authentication required.",
      });
    }

    const token = authorization.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,

        message: "Authentication token missing.",
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,

        message: "Authentication configuration error.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ==================================================
    // ROLE
    // ==================================================

    if (decoded.role !== "staff" || !decoded.staffId) {
      return res.status(403).json({
        success: false,

        message: "Staff access required.",
      });
    }

    // ==================================================
    // FIND STAFF
    // ==================================================

    const staff = await Staff.findOne({
      staffId: decoded.staffId,
    });

    if (!staff) {
      return res.status(401).json({
        success: false,

        message: "Staff account not found.",
      });
    }

    // ==================================================
    // STATUS
    // ==================================================

    if (staff.status === "suspended") {
      return res.status(403).json({
        success: false,

        status: "suspended",

        message: "Staff account is suspended.",
      });
    }

    if (staff.status !== "active") {
      return res.status(403).json({
        success: false,

        status: "inactive",

        message: "Staff account is inactive.",
      });
    }

    // ==================================================
    // ATTACH TO REQUEST
    // ==================================================

    req.staff = {
      staffId: staff.staffId,

      name: staff.name,

      email: staff.email,

      role: "staff",

      permissions: staff.permissions,
    };

    return next();
  } catch (error) {
    console.error("STAFF AUTH ERROR:", error);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,

        message: "Staff session has expired.",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,

        message: "Invalid Staff authentication token.",
      });
    }

    return res.status(500).json({
      success: false,

      message: "Staff authentication failed.",
    });
  }
};

module.exports = staffAuth;
