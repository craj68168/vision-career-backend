const bcrypt = require("bcryptjs");

const crypto = require("crypto");

const Seeker = require("../../models/seekers/seekerSchema");

// ======================================================
// SET INITIAL PASSWORD
//
// POST /api/seekers/auth/set-password
//
// Used for Admin-created accounts only.
//
// BODY:
// {
//   "setup_token": "...",
//   "password": "...",
//   "confirm_password": "..."
// }
// ======================================================

exports.setInitialPassword = async (req, res) => {
  try {
    const {
      setup_token,

      password,

      confirm_password,
    } = req.body;

    // ==================================================
    // REQUIRED
    // ==================================================

    if (!setup_token || !password || !confirm_password) {
      return res.status(400).json({
        status: "error",

        message: "Setup token, password and confirm password are required.",
      });
    }

    // ==================================================
    // PASSWORD MATCH
    // ==================================================

    if (password !== confirm_password) {
      return res.status(400).json({
        status: "error",

        message: "Passwords do not match.",
      });
    }

    // ==================================================
    // PASSWORD LENGTH
    // ==================================================

    if (password.length < 8) {
      return res.status(400).json({
        status: "error",

        message: "Password must be at least 8 characters.",
      });
    }

    // ==================================================
    // HASH TOKEN
    // ==================================================

    const setupTokenHash = crypto
      .createHash("sha256")
      .update(setup_token)
      .digest("hex");

    // ==================================================
    // FIND ADMIN-CREATED SEEKER
    // ==================================================

    const seeker = await Seeker.findOne({
      password_reset_token_hash: setupTokenHash,

      password_reset_token_expires: {
        $gt: new Date(),
      },

      password_setup_required: true,

      account_source: "admin",
    }).select(
      "+password " +
        "+password_reset_token_hash " +
        "+password_reset_token_expires",
    );

    if (!seeker) {
      return res.status(400).json({
        status: "error",

        message: "Password setup link is invalid or has expired.",
      });
    }

    // ==================================================
    // HASH PASSWORD
    // ==================================================

    const salt = await bcrypt.genSalt(12);

    const hashedPassword = await bcrypt.hash(password, salt);

    // ==================================================
    // UPDATE
    // ==================================================

    seeker.password = hashedPassword;

    seeker.password_setup_required = false;

    seeker.password_reset_token_hash = null;

    seeker.password_reset_token_expires = null;

    seeker.password_reset_code_hash = null;

    seeker.password_reset_code_expires = null;

    seeker.password_reset_attempts = 0;

    await seeker.save();

    // ==================================================
    // RESPONSE
    // ==================================================

    return res.status(200).json({
      status: "success",

      message:
        "Password created successfully. You can now sign in to your Vision Career account.",
    });
  } catch (error) {
    console.error("SET INITIAL SEEKER PASSWORD ERROR:", error);

    return res.status(500).json({
      status: "error",

      message: "Failed to create password.",
    });
  }
};
