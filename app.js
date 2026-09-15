const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");

require("dotenv").config();

// ✅ FIXED IMPORT (NO destructuring)
const registerRoutes = require("./routes/providers/registerRoutes");
const profileRoutes = require("./routes/providers/profileRoutes");
const vacancyRoutes = require("./routes/providers/vacancyRoutes");
const forgotRoutes = require("./routes/providers/forgotRoutes");
const recruitRoutes = require("./routes/providers/recruitRoutes");

const seekerAuthRoutes = require("./routes/seekers/authRoutes");
const seekerProfileRoutes = require("./routes/seekers/profileRoutes");

const seekerApplicationRoutes = require("./routes/seekers/applicationRoutes");

const seekerResumeRoutes = require("./routes/seekers/resumeRoutes");

const app = express();
const PORT = process.env.PORT || 8000;

// ======================================================
// MIDDLEWARE
// ======================================================

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================================================
// STATIC FILES
// ======================================================

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ======================================================
// HEALTH CHECK
// ======================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Job portal API is running.",
  });
});

// ======================================================
// PROVIDER ROUTES
// ======================================================

// ✅ ONLY ONE AUTH ROUTE
app.use("/api/auth/providers", registerRoutes);

// ======================================================
// SEEKER AUTH ROUTES
// ======================================================
app.use("/api/seekers/resume", seekerResumeRoutes);

app.use("/api/seekers/auth", seekerAuthRoutes);
// other provider routes
// app.use("/api/profile", profileRoutes);

app.use("/api/auth/providers", forgotRoutes);
app.use("/api/providers", vacancyRoutes);
app.use("/api/providers", recruitRoutes);

// ======================================================
// SEEKER ROUTES
// ======================================================

app.use("/api/seekers/profile", seekerProfileRoutes);

app.use("/api/seekers/applications", seekerApplicationRoutes);

// Existing provider profile routes
app.use("/api/auth", registerRoutes);
app.use("/api/providers", profileRoutes);

// ======================================================
// NOT FOUND
// ======================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ======================================================
// ERROR HANDLER
// ======================================================

app.use((err, req, res, next) => {
  console.error("Server error:", err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

// ======================================================
// START SERVER
// ======================================================

const startServer = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI missing in .env");
    }

    await mongoose.connect(process.env.MONGO_URI);

    console.log("✅ MongoDB connected");

    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Startup error:", error.message);
    process.exit(1);
  }
};

startServer();
