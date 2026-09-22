const jwt = require("jsonwebtoken");

const Admin = require("../../models/admin/adminSchema");

// ======================================================
// CREATE JWT
// ======================================================

const createAdminToken = (admin) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET missing in .env");
  }

  return jwt.sign(
    {
      adminId: admin.adminId,

      username: admin.username,

      role: "admin",
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "12h",
    },
  );
};

// ======================================================
// SERIALIZE ADMIN
// ======================================================

const serializeAdmin = (admin) => ({
  adminId: admin.adminId,

  username: admin.username,

  role: admin.role,

  status: admin.status,

  lastLoginAt: admin.lastLoginAt,

  passwordChangedAt: admin.passwordChangedAt,

  createdAt: admin.createdAt,

  updatedAt: admin.updatedAt,
});

// ======================================================
// ADMIN LOGIN
//
// POST /api/admin/auth/login
// ======================================================

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // ==================================================
    // VALIDATION
    // ==================================================

    if (!username || typeof username !== "string" || !username.trim()) {
      return res.status(400).json({
        success: false,

        message: "Username is required.",
      });
    }

    if (!password || typeof password !== "string") {
      return res.status(400).json({
        success: false,

        message: "Password is required.",
      });
    }

    // ==================================================
    // FIND ADMIN
    // ==================================================

    const admin = await Admin.findOne({
      username: username.trim().toLowerCase(),
    }).select("+password");

    if (!admin) {
      return res.status(401).json({
        success: false,

        message: "Invalid username or password.",
      });
    }

    // ==================================================
    // ACCOUNT STATUS
    // ==================================================

    if (admin.status !== "active") {
      return res.status(403).json({
        success: false,

        message:
          admin.status === "suspended"
            ? "Your admin account has been suspended."
            : "Your admin account is inactive.",
      });
    }

    // ==================================================
    // VERIFY PASSWORD
    // ==================================================

    const passwordMatches = await admin.comparePassword(password);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,

        message: "Invalid username or password.",
      });
    }

    // ==================================================
    // LAST LOGIN
    // ==================================================

    admin.lastLoginAt = new Date();

    await admin.save();

    // ==================================================
    // TOKEN
    // ==================================================

    const token = createAdminToken(admin);

    // ==================================================
    // RESPONSE
    // ==================================================

    return res.status(200).json({
      success: true,

      message: "Login successful.",

      token,

      user: serializeAdmin(admin),
    });
  } catch (error) {
    console.error("ADMIN LOGIN ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to login.",
    });
  }
};

// ======================================================
// GET CURRENT ADMIN
//
// GET /api/admin/auth/me
// ======================================================

exports.me = async (req, res) => {
  try {
    const admin = await Admin.findOne({
      adminId: req.admin.adminId,
    }).select(
      "adminId username role status lastLoginAt passwordChangedAt createdAt updatedAt",
    );

    if (!admin) {
      return res.status(404).json({
        success: false,

        message: "Admin account not found.",
      });
    }

    return res.status(200).json({
      success: true,

      user: serializeAdmin(admin),
    });
  } catch (error) {
    console.error("GET ADMIN PROFILE ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load admin profile.",
    });
  }
};

// ======================================================
// UPDATE ADMIN CREDENTIALS
//
// PATCH /api/admin/auth/credentials
//
// IMPORTANT:
// Admin ID comes from adminAuth.
// Frontend never sends adminId.
// ======================================================

exports.updateCredentials = async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body;

    // ==================================================
    // VALIDATION
    // ==================================================

    if (!username || typeof username !== "string" || !username.trim()) {
      return res.status(400).json({
        success: false,

        message: "Username is required.",
      });
    }

    const normalizedUsername = username.trim().toLowerCase();

    if (normalizedUsername.length < 3) {
      return res.status(400).json({
        success: false,

        message: "Username must be at least 3 characters.",
      });
    }

    if (normalizedUsername.length > 100) {
      return res.status(400).json({
        success: false,

        message: "Username cannot exceed 100 characters.",
      });
    }

    if (
      !currentPassword ||
      typeof currentPassword !== "string" ||
      !currentPassword.trim()
    ) {
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
    // FIND CURRENT ADMIN
    // ==================================================

    const admin = await Admin.findOne({
      adminId: req.admin.adminId,
    }).select("+password");

    if (!admin) {
      return res.status(404).json({
        success: false,

        message: "Admin account not found.",
      });
    }

    if (admin.status !== "active") {
      return res.status(403).json({
        success: false,

        message: "Admin account is not active.",
      });
    }

    // ==================================================
    // VERIFY CURRENT PASSWORD
    //
    // Return 400 rather than 401.
    //
    // 401 should represent an invalid access token.
    // A wrong form password should not cause global auth
    // interceptors to log the Admin out.
    // ==================================================

    const currentPasswordMatches = await admin.comparePassword(currentPassword);

    if (!currentPasswordMatches) {
      return res.status(400).json({
        success: false,

        message: "Current password is incorrect.",
      });
    }

    // ==================================================
    // NEW PASSWORD CANNOT EQUAL CURRENT PASSWORD
    // ==================================================

    const samePassword = await admin.comparePassword(newPassword);

    if (samePassword) {
      return res.status(400).json({
        success: false,

        message: "New password must be different from your current password.",
      });
    }

    // ==================================================
    // CHECK USERNAME DUPLICATE
    // ==================================================

    const existingUsername = await Admin.exists({
      adminId: {
        $ne: admin.adminId,
      },

      username: normalizedUsername,
    });

    if (existingUsername) {
      return res.status(409).json({
        success: false,

        message: "This username is already in use.",
      });
    }

    // ==================================================
    // UPDATE
    // ==================================================

    admin.username = normalizedUsername;

    admin.password = newPassword;

    admin.passwordChangedAt = new Date();

    await admin.save();

    // ==================================================
    // CREATE NEW JWT
    //
    // Previous JWTs will be rejected by adminAuth because
    // they were issued before passwordChangedAt.
    // ==================================================

    const token = createAdminToken(admin);

    // ==================================================
    // RESPONSE
    // ==================================================

    return res.status(200).json({
      success: true,

      message: "Admin username and password updated successfully.",

      token,

      user: serializeAdmin(admin),
    });
  } catch (error) {
    console.error("UPDATE ADMIN CREDENTIALS ERROR:", error);

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,

        message: "This username is already in use.",
      });
    }

    return res.status(500).json({
      success: false,

      message: "Failed to update Admin credentials.",
    });
  }
};
