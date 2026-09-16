const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");

require("dotenv").config();

// ======================================================
// PROVIDER ROUTES
// ======================================================

const registerRoutes = require("./routes/providers/registerRoutes");

const profileRoutes = require("./routes/providers/profileRoutes");

const vacancyRoutes = require("./routes/providers/vacancyRoutes");

const forgotRoutes = require("./routes/providers/forgotRoutes");

const recruitRoutes = require("./routes/providers/recruitRoutes");

const providerApplicationRoutes = require("./routes/providers/applicationRoutes");

// ======================================================
// SEEKER ROUTES
// ======================================================

const seekerAuthRoutes = require("./routes/seekers/authRoutes");

const seekerProfileRoutes = require("./routes/seekers/profileRoutes");

const seekerApplicationRoutes = require("./routes/seekers/applicationRoutes");

const seekerResumeRoutes = require("./routes/seekers/resumeRoutes");

const seekerVacancyRoutes = require("./routes/seekers/vacancyRoutes");

const seekerDashboardRoutes = require("./routes/seekers/dashboardRoutes");

// ======================================================
// ADMIN ROUTES
// ======================================================

const adminAuthRoutes = require("./routes/admin/authRoutes");

const adminDashboardRoutes = require("./routes/admin/dashboardRoutes");

// ======================================================
// STARTUP MODELS
// ======================================================

const Vacancy = require("./models/providers/vacancySchema");

// ======================================================
// STARTUP UTILITIES
// ======================================================

const bootstrapAdmin = require("./utils/bootstrapAdmin");

// ======================================================
// APP
// ======================================================

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

app.use(
  express.urlencoded({
    extended: true,
  }),
);

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
// ADMIN AUTH
// ======================================================

app.use("/api/admin/auth", adminAuthRoutes);

app.use("/api/admin/dashboard", adminDashboardRoutes);
// ======================================================
// SEEKER AUTH / RESUME
// ======================================================

app.use("/api/seekers/resume", seekerResumeRoutes);

app.use("/api/seekers/auth", seekerAuthRoutes);

// ======================================================
// PROVIDER AUTH
// ======================================================

app.use("/api/auth/providers", registerRoutes);

app.use("/api/auth/providers", forgotRoutes);

// ======================================================
// PROVIDER PROFILE
// ======================================================

app.use("/api/providers/profile", profileRoutes);

// ======================================================
// PROVIDER VACANCIES
// ======================================================

app.use("/api/providers/vacancies", vacancyRoutes);

// ======================================================
// PROVIDER APPLICATIONS
// ======================================================

app.use("/api/providers/applications", providerApplicationRoutes);

// ======================================================
// PROVIDER RECRUIT / PLACEMENT REQUESTS
// ======================================================

app.use("/api/providers/recruits", recruitRoutes);

// ======================================================
// SEEKER PROFILE
// ======================================================

app.use("/api/seekers/profile", seekerProfileRoutes);

// ======================================================
// SEEKER APPLICATIONS
// ======================================================

app.use("/api/seekers/applications", seekerApplicationRoutes);

// ======================================================
// SEEKER VACANCIES
// ======================================================

app.use("/api/seekers/vacancies", seekerVacancyRoutes);

// ======================================================
// SEEKER DASHBOARD
// ======================================================

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

    // ==================================================
    // DATABASE
    // ==================================================

    await mongoose.connect(process.env.MONGO_URI);

    console.log("✅ MongoDB connected");

    // ==================================================
    // CLEAN OLD VACANCY INDEX
    // ==================================================

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

    // ==================================================
    // CURRENT VACANCY INDEXES
    // ==================================================

    await Vacancy.init();

    console.log("✅ Vacancy indexes ready");

    // ==================================================
    // CREATE INITIAL ADMIN IF NEEDED
    // ==================================================

    await bootstrapAdmin();

    // ==================================================
    // START SERVER
    // ==================================================

    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Startup error:", error);

    process.exit(1);
  }
};

startServer();
