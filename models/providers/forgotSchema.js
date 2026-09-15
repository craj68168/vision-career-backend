const mongoose = require("mongoose");

const forgotSchema = new mongoose.Schema(
  {
    registerId: { type: String, required: true, index: true },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    resetCodeHash: { type: String, required: true, select: false },

    resetCodeExpires: { type: Date, required: true, select: false },

    resetAttempts: { type: Number, default: 0, select: false },

    resetTokenHash: { type: String, default: null, select: false },

    resetTokenExpires: { type: Date, default: null, select: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProviderForgotPassword", forgotSchema);