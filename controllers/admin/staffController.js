const bcrypt = require("bcryptjs");

const Staff = require("../../models/admin/staffSchema");

const { STAFF_PERMISSIONS } = require("../../config/staffPermissions");

// ======================================================
// SERIALIZER
// ======================================================

const serializeStaff = (staff) => ({
  id: staff._id,

  staffId: staff.staffId,

  name: staff.name,

  email: staff.email,

  phone: staff.phone,

  role: staff.role,

  status: staff.status,

  permissions: staff.permissions,

  createdByAdminId: staff.createdByAdminId,

  lastLoginAt: staff.lastLoginAt,

  passwordChangedAt: staff.passwordChangedAt,

  createdAt: staff.createdAt,

  updatedAt: staff.updatedAt,
});

// ======================================================
// VALIDATE PERMISSIONS
// ======================================================

const validatePermissions = (permissions) => {
  if (!Array.isArray(permissions)) {
    return false;
  }

  return permissions.every((permission) =>
    STAFF_PERMISSIONS.includes(permission),
  );
};

// ======================================================
// CREATE STAFF
//
// POST /api/admin/staff
// ======================================================

exports.createStaff = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      permissions = [],
      status = "active",
    } = req.body;

    // ==================================================
    // REQUIRED FIELDS
    // ==================================================

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,

        message: "Name, email and password are required.",
      });
    }

    // ==================================================
    // PASSWORD
    // ==================================================

    if (String(password).length < 8) {
      return res.status(400).json({
        success: false,

        message: "Password must be at least 8 characters.",
      });
    }

    // ==================================================
    // STATUS
    // ==================================================

    if (!["active", "inactive", "suspended"].includes(status)) {
      return res.status(400).json({
        success: false,

        message: "Invalid Staff status.",
      });
    }

    // ==================================================
    // PERMISSIONS
    // ==================================================

    if (!validatePermissions(permissions)) {
      return res.status(400).json({
        success: false,

        message: "One or more Staff permissions are invalid.",
      });
    }

    // ==================================================
    // EMAIL
    // ==================================================

    const normalizedEmail = String(email).trim().toLowerCase();

    const existing = await Staff.findOne({
      email: normalizedEmail,
    });

    if (existing) {
      return res.status(409).json({
        success: false,

        message: "A Staff account with this email already exists.",
      });
    }

    // ==================================================
    // HASH PASSWORD
    // ==================================================

    const hashedPassword = await bcrypt.hash(String(password), 10);

    // ==================================================
    // CREATE
    // ==================================================

    const staff = await Staff.create({
      name: String(name).trim(),

      email: normalizedEmail,

      password: hashedPassword,

      phone: phone ? String(phone).trim() : null,

      status,

      permissions: [...new Set(permissions)],

      createdByAdminId: req.admin.adminId,
    });

    return res.status(201).json({
      success: true,

      message: "Staff account created successfully.",

      data: serializeStaff(staff),
    });
  } catch (error) {
    console.error("CREATE STAFF ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,

        message: "Staff email or Staff ID already exists.",
      });
    }

    return res.status(500).json({
      success: false,

      message: "Failed to create Staff account.",
    });
  }
};

// ======================================================
// GET ALL STAFF
//
// GET /api/admin/staff
// ======================================================

exports.getStaffList = async (req, res) => {
  try {
    const staff = await Staff.find()
      .sort({
        createdAt: -1,
      })
      .lean();

    const data = staff.map(serializeStaff);

    return res.status(200).json({
      success: true,

      count: data.length,

      summary: {
        total: data.length,

        active: data.filter((item) => item.status === "active").length,

        inactive: data.filter((item) => item.status === "inactive").length,

        suspended: data.filter((item) => item.status === "suspended").length,
      },

      data,
    });
  } catch (error) {
    console.error("GET STAFF ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load Staff.",
    });
  }
};

// ======================================================
// GET ONE STAFF
//
// GET /api/admin/staff/:staffId
// ======================================================

exports.getStaffById = async (req, res) => {
  try {
    const staff = await Staff.findOne({
      staffId: req.params.staffId,
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
    return res.status(500).json({
      success: false,

      message: "Failed to load Staff account.",
    });
  }
};

// ======================================================
// UPDATE STAFF
//
// PATCH /api/admin/staff/:staffId
// ======================================================

exports.updateStaff = async (req, res) => {
  try {
    const staff = await Staff.findOne({
      staffId: req.params.staffId,
    });

    if (!staff) {
      return res.status(404).json({
        success: false,

        message: "Staff account not found.",
      });
    }

    const { name, email, phone, status, permissions } = req.body;

    // ==================================================
    // NAME
    // ==================================================

    if (name !== undefined) {
      const normalizedName = String(name).trim();

      if (!normalizedName) {
        return res.status(400).json({
          success: false,

          message: "Staff name cannot be empty.",
        });
      }

      staff.name = normalizedName;
    }

    // ==================================================
    // EMAIL
    // ==================================================

    if (email !== undefined) {
      const normalizedEmail = String(email).trim().toLowerCase();

      if (!normalizedEmail) {
        return res.status(400).json({
          success: false,

          message: "Staff email cannot be empty.",
        });
      }

      const existing = await Staff.findOne({
        email: normalizedEmail,

        staffId: {
          $ne: staff.staffId,
        },
      });

      if (existing) {
        return res.status(409).json({
          success: false,

          message: "Another Staff account already uses this email.",
        });
      }

      staff.email = normalizedEmail;
    }

    // ==================================================
    // PHONE
    // ==================================================

    if (phone !== undefined) {
      staff.phone = phone ? String(phone).trim() : null;
    }

    // ==================================================
    // STATUS
    // ==================================================

    if (status !== undefined) {
      if (!["active", "inactive", "suspended"].includes(status)) {
        return res.status(400).json({
          success: false,

          message: "Invalid Staff status.",
        });
      }

      staff.status = status;
    }

    // ==================================================
    // PERMISSIONS
    // ==================================================

    if (permissions !== undefined) {
      if (!validatePermissions(permissions)) {
        return res.status(400).json({
          success: false,

          message: "One or more Staff permissions are invalid.",
        });
      }

      staff.permissions = [...new Set(permissions)];
    }

    await staff.save();

    return res.status(200).json({
      success: true,

      message: "Staff account updated.",

      data: serializeStaff(staff),
    });
  } catch (error) {
    console.error("UPDATE STAFF ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,

        message: "Staff email already exists.",
      });
    }

    return res.status(500).json({
      success: false,

      message: "Failed to update Staff account.",
    });
  }
};

// ======================================================
// RESET STAFF PASSWORD
//
// PATCH /api/admin/staff/:staffId/password
// ======================================================

exports.resetStaffPassword = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || String(password).length < 8) {
      return res.status(400).json({
        success: false,

        message: "Password must be at least 8 characters.",
      });
    }

    const staff = await Staff.findOne({
      staffId: req.params.staffId,
    }).select("+password");

    if (!staff) {
      return res.status(404).json({
        success: false,

        message: "Staff account not found.",
      });
    }

    staff.password = await bcrypt.hash(String(password), 10);

    staff.passwordChangedAt = new Date();

    await staff.save();

    return res.status(200).json({
      success: true,

      message: "Staff password reset successfully.",
    });
  } catch (error) {
    console.error("RESET STAFF PASSWORD ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to reset Staff password.",
    });
  }
};

// ======================================================
// PERMISSION OPTIONS
//
// GET /api/admin/staff/permissions/options
// ======================================================

exports.getStaffPermissionOptions = async (req, res) => {
  return res.status(200).json({
    success: true,

    data: STAFF_PERMISSIONS,
  });
};
