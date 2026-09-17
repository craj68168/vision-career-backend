const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Staff = require("../../models/admin/staffSchema");

// ======================================================
// SERIALIZER
// ======================================================

const serializeStaff = (staff) => ({
  staffId: staff.staffId,
  name: staff.name,
  email: staff.email,
  phone: staff.phone,
  role: staff.role,
  status: staff.status,
  permissions: staff.permissions || [],
  lastLoginAt: staff.lastLoginAt,
  createdAt: staff.createdAt,
  updatedAt: staff.updatedAt,
});

// ======================================================
// STAFF LOGIN
//
// POST /api/staff/auth/login
// ======================================================

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ==================================================
    // VALIDATION
    // ==================================================

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET missing in .env");

      return res.status(500).json({
        success: false,
        message: "Authentication configuration error.",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // ==================================================
    // FIND STAFF
    // ==================================================

    const staff = await Staff.findOne({
      email: normalizedEmail,
    }).select("+password");

    if (!staff) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // ==================================================
    // PASSWORD
    // ==================================================

    const passwordMatches = await bcrypt.compare(
      String(password),
      staff.password,
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // ==================================================
    // STATUS
    // ==================================================

    if (staff.status === "suspended") {
      return res.status(403).json({
        success: false,
        status: "suspended",
        message: "Your Staff account has been suspended.",
      });
    }

    if (staff.status !== "active") {
      return res.status(403).json({
        success: false,
        status: "inactive",
        message: "Your Staff account is inactive.",
      });
    }

    // ==================================================
    // JWT
    // ==================================================

    const token = jwt.sign(
      {
        staffId: staff.staffId,
        role: "staff",
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "8h",
      },
    );

    // ==================================================
    // LAST LOGIN
    // ==================================================

    staff.lastLoginAt = new Date();

    await staff.save();

    // ==================================================
    // RESPONSE
    // ==================================================

    return res.status(200).json({
      success: true,

      message: "Staff login successful.",

      token,

      user: serializeStaff(staff),
    });
  } catch (error) {
    console.error("STAFF LOGIN ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Staff login failed.",
    });
  }
};

// ======================================================
// CURRENT STAFF
//
// GET /api/staff/auth/me
// ======================================================

exports.getCurrentStaff = async (req, res) => {
  try {
    const staff = await Staff.findOne({
      staffId: req.staff.staffId,
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff account not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: serializeStaff(staff),
    });
  } catch (error) {
    console.error("GET CURRENT STAFF ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load Staff account.",
    });
  }
};
