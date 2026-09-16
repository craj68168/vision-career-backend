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
    //
    // password is select:false in schema,
    // therefore explicitly select it here.
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
    // CREATE TOKEN
    // ==================================================

    const token = createAdminToken(admin);

    // ==================================================
    // SAVE LAST LOGIN
    // ==================================================

    admin.lastLoginAt = new Date();

    await admin.save();

    // ==================================================
    // RESPONSE
    // ==================================================

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        adminId: admin.adminId,
        username: admin.username,
        role: admin.role,
        status: admin.status,
        lastLoginAt: admin.lastLoginAt,
      },
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
    }).select("adminId username role status lastLoginAt createdAt updatedAt");

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin account not found.",
      });
    }

    return res.status(200).json({
      success: true,

      user: {
        adminId: admin.adminId,

        username: admin.username,

        role: admin.role,

        status: admin.status,

        lastLoginAt: admin.lastLoginAt,

        createdAt: admin.createdAt,

        updatedAt: admin.updatedAt,
      },
    });
  } catch (error) {
    console.error("GET ADMIN PROFILE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load admin profile.",
    });
  }
};
