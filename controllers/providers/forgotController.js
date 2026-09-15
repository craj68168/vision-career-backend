const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const Register = require("../../models/providers/registerSchema");
const ForgotPassword = require("../../models/providers/forgotSchema");
const sendEmail = require("../../utils/providers/send-email");

// ================= FORGOT PASSWORD =================
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        status: "error",
        message: "Email is required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const register = await Register.findOne({ email: normalizedEmail });

    // Always return success (security reason)
    if (!register) {
      return res.json({
        status: "success",
        message: "If email exists, OTP sent",
      });
    }

    await ForgotPassword.deleteMany({ registerId: register.registerId });

    // 6-digit OTP
    const code = crypto.randomInt(100000, 1000000).toString();

    const codeHash = crypto
      .createHash("sha256")
      .update(code)
      .digest("hex");

    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await ForgotPassword.create({
      registerId: register.registerId,
      email: normalizedEmail,
      resetCodeHash: codeHash,
      resetCodeExpires: expires,
      resetAttempts: 0,
    });

    await sendEmail({
      to: normalizedEmail,
      subject: "Password Reset OTP",
      text: `Your OTP is ${code}`,
      html: `<h2>Your OTP is <b>${code}</b></h2><p>Valid for 10 minutes</p>`,
    });

    return res.json({
      status: "success",
      message: "OTP sent successfully",
    });
  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

// ================= VERIFY OTP =================
exports.verifyResetCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        status: "error",
        message: "Email and OTP required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const record = await ForgotPassword.findOne({ email: normalizedEmail })
      .select("+resetCodeHash +resetCodeExpires +resetAttempts");

    if (!record) {
      return res.status(400).json({
        status: "error",
        message: "Invalid request",
      });
    }

    if (record.resetCodeExpires < new Date()) {
      await ForgotPassword.deleteOne({ _id: record._id });
      return res.status(400).json({
        status: "error",
        message: "OTP expired",
      });
    }

    if (record.resetAttempts >= 5) {
      return res.status(429).json({
        status: "error",
        message: "Too many attempts",
      });
    }

    const hash = crypto
      .createHash("sha256")
      .update(code.toString())
      .digest("hex");

    if (hash !== record.resetCodeHash) {
      record.resetAttempts += 1;
      await record.save();
      return res.status(400).json({
        status: "error",
        message: "Invalid OTP",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    const resetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    record.resetTokenHash = resetTokenHash;
    record.resetTokenExpires = new Date(Date.now() + 10 * 60 * 1000);

    record.resetCodeHash = null;
    record.resetCodeExpires = null;
    record.resetAttempts = 0;

    await record.save({ validateBeforeSave: false });

    return res.json({
      status: "success",
      message: "OTP verified",
      reset_token: resetToken,
    });
  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

// ================= RESET PASSWORD =================
exports.resetPassword = async (req, res) => {
  try {
    const { reset_token, password, confirm_password } = req.body;

    if (!reset_token || !password || !confirm_password) {
      return res.status(400).json({
        status: "error",
        message: "All fields required",
      });
    }

    if (password !== confirm_password) {
      return res.status(400).json({
        status: "error",
        message: "Passwords not match",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        status: "error",
        message: "Min 8 characters required",
      });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(reset_token)
      .digest("hex");

    const record = await ForgotPassword.findOne({
      resetTokenHash: tokenHash,
      resetTokenExpires: { $gt: new Date() },
    }).select("+resetTokenHash +resetTokenExpires");

    if (!record) {
      return res.status(400).json({
        status: "error",
        message: "Invalid or expired token",
      });
    }

    const register = await Register.findOne({
      registerId: record.registerId,
    }).select("+password");

    if (!register) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    register.password = hashedPassword;
    await register.save();

    await ForgotPassword.deleteOne({ _id: record._id });

    return res.json({
      status: "success",
      message: "Password reset successful",
    });
  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};