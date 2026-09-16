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

const seekerVacancyRoutes = require("./routes/seekers/vacancyRoutes");
const seekerDashboardRoutes = require("./routes/seekers/dashboardRoutes");
const Vacancy = require("./models/providers/vacancySchema");

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
// SEEKER AUTH ROUTES
// ======================================================
app.use("/api/seekers/resume", seekerResumeRoutes);

app.use("/api/seekers/auth", seekerAuthRoutes);
// other provider routes
// app.use("/api/profile", profileRoutes);

// ======================================================
// PROVIDER ROUTES
// ======================================================

app.use("/api/auth/providers", registerRoutes);
app.use("/api/auth/providers", forgotRoutes);
// ======================================================
// PROVIDER VACANCIES
// ======================================================
app.use("/api/providers/vacancies", vacancyRoutes);

// ======================================================
// PROVIDER RECRUIT / PLACEMENT REQUESTS
// ======================================================
app.use("/api/providers/recruits", recruitRoutes);

// ======================================================
// PROVIDER PROFILE
// ======================================================

app.use("/api/providers/profile", profileRoutes);

// ======================================================
// SEEKER ROUTES
// ======================================================

app.use("/api/seekers/profile", seekerProfileRoutes);

app.use("/api/seekers/applications", seekerApplicationRoutes);

// Existing SeekerSide vacancy routes
app.use("/api/seekers/vacancies", seekerVacancyRoutes);

app.use("/api/seekers/dashboard", seekerDashboardRoutes);

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

    // ================================================
    // CONNECT DATABASE
    // ================================================

    await mongoose.connect(process.env.MONGO_URI);

    console.log("✅ MongoDB connected");

    // ================================================
    // FIX OLD VACANCY INDEX
    // ================================================
    //
    // Previous vacancy schema used:
    //
    // vacancy_id
    //
    // Current vacancy schema uses:
    //
    // vacancyId
    //
    // If old unique index still exists,
    // MongoDB throws:
    //
    // E11000 duplicate key
    // vacancy_id: null
    //
    // ================================================

    const indexes = await Vacancy.collection.indexes();

    console.log(
      "Current vacancy indexes:",
      indexes.map((index) => index.name),
    );

    const oldVacancyIndex = indexes.find(
      (index) => index.name === "vacancy_id_1",
    );

    if (oldVacancyIndex) {
      await Vacancy.collection.dropIndex("vacancy_id_1");

      console.log("✅ Removed old vacancy_id_1 index");
    }

    // ================================================
    // MAKE SURE CURRENT SCHEMA INDEXES EXIST
    // ================================================

    await Vacancy.init();

    console.log("✅ Vacancy indexes ready");

    // ================================================
    // START SERVER
    // ================================================

    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Startup error:", error);

    process.exit(1);
  }
};

startServer();
