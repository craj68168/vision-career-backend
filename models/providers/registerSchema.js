const mongoose = require("mongoose");
const Counter = require("../providers/counterModel");

const registerSchema = new mongoose.Schema(
  {
    registerId: {
      type: String,
      unique: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    companyName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: ["provider", "seeker"],
      default: "provider",
    },
  },
  { timestamps: true }
);

// 🔥 AUTO REGISTER ID: r-000001
registerSchema.pre("save", async function () {
  if (this.registerId) return;

  const counter = await Counter.findByIdAndUpdate(
    { _id: "registerId" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  this.registerId = `r-${counter.seq.toString().padStart(6, "0")}`;
});

module.exports = mongoose.model("Register", registerSchema);