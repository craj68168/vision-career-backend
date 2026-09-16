const Admin = require("../models/admin/adminSchema");

// ======================================================
// CREATE FIRST ADMIN
// ======================================================

const bootstrapAdmin = async () => {
  const existingAdminCount = await Admin.countDocuments();

  // ==================================================
  // ADMIN ALREADY EXISTS
  // ==================================================

  if (existingAdminCount > 0) {
    console.log("✅ Admin account already exists");

    return;
  }

  // ==================================================
  // READ INITIAL ADMIN CREDENTIALS
  // ==================================================

  const username = process.env.ADMIN_USERNAME?.trim();

  const password = process.env.ADMIN_PASSWORD;

  // ==================================================
  // SKIP WHEN ENV IS MISSING
  // ==================================================

  if (!username || !password) {
    console.warn("⚠️ No Admin account exists.");

    console.warn(
      "⚠️ Add ADMIN_USERNAME and ADMIN_PASSWORD to .env and restart the server.",
    );

    return;
  }

  // ==================================================
  // PASSWORD VALIDATION
  // ==================================================

  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must contain at least 8 characters.");
  }

  // ==================================================
  // CREATE ADMIN
  // ==================================================

  const admin = await Admin.create({
    username,
    password,
    role: "admin",
    status: "active",
  });
  console.log(`✅ Initial Admin created: ${admin.username} (${admin.adminId})`);
};

module.exports = bootstrapAdmin;
