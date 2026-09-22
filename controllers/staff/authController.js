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

  passwordChangedAt: staff.passwordChangedAt,

  createdAt: staff.createdAt,

  updatedAt: staff.updatedAt,
});

// ======================================================
// CREATE STAFF TOKEN
// ======================================================

const createStaffToken = (staff) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET missing in .env");
  }

  return jwt.sign(
    {
      staffId: staff.staffId,

      role: "staff",
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "8h",
    },
  );
};

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
    // LAST LOGIN
    // ==================================================

    staff.lastLoginAt = new Date();

    await staff.save();

    // ==================================================
    // TOKEN
    // ==================================================

    const token = createStaffToken(staff);

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

// ======================================================
// CHANGE STAFF PASSWORD
//
// PATCH /api/staff/auth/password
//
// Staff can only change their own password.
// Email, role, permissions, status, etc. remain Admin
// managed.
// ======================================================

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // ==================================================
    // VALIDATION
    // ==================================================

    if (!currentPassword || typeof currentPassword !== "string") {
      return res.status(400).json({
        success: false,

        message: "Current password is required.",
      });
    }

    if (!newPassword || typeof newPassword !== "string") {
      return res.status(400).json({
        success: false,

        message: "New password is required.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,

        message: "New password must be at least 8 characters.",
      });
    }

    if (newPassword.length > 128) {
      return res.status(400).json({
        success: false,

        message: "New password cannot exceed 128 characters.",
      });
    }

    // ==================================================
    // FIND AUTHENTICATED STAFF
    //
    // password uses select:false
    // ==================================================

    const staff = await Staff.findOne({
      staffId: req.staff.staffId,
    }).select("+password");

    if (!staff) {
      return res.status(404).json({
        success: false,

        message: "Staff account not found.",
      });
    }

    // ==================================================
    // STATUS
    // ==================================================

    if (staff.status !== "active") {
      return res.status(403).json({
        success: false,

        message: "Staff account is not active.",
      });
    }

    // ==================================================
    // VERIFY CURRENT PASSWORD
    //
    // IMPORTANT:
    // Use 400 instead of 401 here.
    //
    // A wrong form password should not cause a global
    // axios 401 interceptor to treat the JWT as invalid.
    // ==================================================

    const currentPasswordMatches = await bcrypt.compare(
      currentPassword,
      staff.password,
    );

    if (!currentPasswordMatches) {
      return res.status(400).json({
        success: false,

        message: "Current password is incorrect.",
      });
    }

    // ==================================================
    // PREVENT SAME PASSWORD
    // ==================================================

    const samePassword = await bcrypt.compare(newPassword, staff.password);

    if (samePassword) {
      return res.status(400).json({
        success: false,

        message: "New password must be different from your current password.",
      });
    }

    // ==================================================
    // HASH NEW PASSWORD
    //
    // Your current Staff schema does not contain a
    // password pre-save hashing hook, therefore hash it
    // here explicitly.
    // ==================================================

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // ==================================================
    // UPDATE
    // ==================================================

    staff.password = hashedPassword;

    staff.passwordChangedAt = new Date();

    await staff.save();

    // ==================================================
    // CREATE NEW TOKEN
    //
    // Existing Staff tokens will fail staffAuth because
    // their iat is older than passwordChangedAt.
    // ==================================================

    const token = createStaffToken(staff);

    return res.status(200).json({
      success: true,

      message: "Password updated successfully.",

      token,

      data: serializeStaff(staff),
    });
  } catch (error) {
    console.error("CHANGE STAFF PASSWORD ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to update password.",
    });
  }
};
