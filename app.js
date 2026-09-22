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

const adminApplicationRoutes = require("./routes/admin/applicationRoutes");

const adminVacancyRoutes = require("./routes/admin/vacancyRoutes");

const adminProviderRoutes = require("./routes/admin/providerRoutes");

const adminSeekerRoutes = require("./routes/admin/seekerRoutes");

const adminPlacementRequestRoutes = require("./routes/admin/placementRequestRoutes");

const adminPlacementBillingRoutes = require("./routes/admin/placementBillingRoutes");

// ======================================================
// PLACEMENT CANDIDATE ROUTES
// ======================================================

const adminPlacementCandidateRoutes = require("./routes/admin/placementCandidateRoutes");

const providerPlacementCandidateRoutes = require("./routes/providers/placementCandidateRoutes");

// ======================================================
// STARTUP MODELS
// ======================================================

const Vacancy = require("./models/providers/vacancySchema");
const Profile = require("./models/providers/profileSchema");

// ======================================================
// STARTUP UTILITIES
// ======================================================

const bootstrapAdmin = require("./utils/bootstrapAdmin");

// ======================================================
// STAFF ROUTES
// ======================================================

const adminStaffRoutes = require("./routes/admin/staffRoutes");

const staffAuthRoutes = require("./routes/staff/authRoutes");

const staffDashboardRoutes = require("./routes/staff/dashboardRoutes");

const staffApplicationRoutes = require("./routes/staff/applicationRoutes");

const staffVacancyRoutes = require("./routes/staff/vacancyRoutes");

const staffSeekerRoutes = require("./routes/staff/seekerRoutes");

const staffProviderRoutes = require("./routes/staff/providerRoutes");

const staffPlacementRequestRoutes = require("./routes/staff/placementRequestRoutes");

const staffPlacementCandidateRoutes = require("./routes/staff/placementCandidateRoutes");

const staffPlacementBillingRoutes = require("./routes/staff/placementBillingRoutes");

const adminTrainingRoutes = require("./routes/admin/trainingRoutes");

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
// ADMIN APPLICATIONS
// ======================================================

app.use("/api/admin/applications", adminApplicationRoutes);

// ======================================================
// ADMIN VACANCIES
// ======================================================

app.use("/api/admin/vacancies", adminVacancyRoutes);

// ======================================================
// ADMIN PROVIDERS
// ======================================================

app.use("/api/admin/providers", adminProviderRoutes);

// ======================================================
// ADMIN SEEKERS
// ======================================================

app.use("/api/admin/seekers", adminSeekerRoutes);

// ======================================================
// ADMIN PLACEMENT-REQUEST
// ======================================================

app.use("/api/admin/placement-requests", adminPlacementRequestRoutes);

app.use("/api/admin/placement-candidates", adminPlacementCandidateRoutes);

app.use(
  "/api/providers/placement-candidates",
  providerPlacementCandidateRoutes,
);

app.use("/api/admin/placement-billings", adminPlacementBillingRoutes);

app.use("/api/admin/staff", adminStaffRoutes);

app.use("/api/staff/auth", staffAuthRoutes);

app.use("/api/staff/dashboard", staffDashboardRoutes);

app.use("/api/staff/applications", staffApplicationRoutes);

app.use("/api/staff/vacancies", staffVacancyRoutes);

app.use("/api/staff/seekers", staffSeekerRoutes);

app.use("/api/staff/providers", staffProviderRoutes);

app.use("/api/staff/placement-requests", staffPlacementRequestRoutes);

app.use("/api/staff/placement-candidates", staffPlacementCandidateRoutes);

app.use("/api/staff/placement-billings", staffPlacementBillingRoutes);

// ======================================================
// ADMIN TRAINING
// ======================================================

app.use("/api/admin/training", adminTrainingRoutes);

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

    // ======================================================
    // CONNECT DATABASE
    // ======================================================

    await mongoose.connect(process.env.MONGO_URI);

    console.log("✅ MongoDB connected");

    // ======================================================
    // LEGACY VACANCY INDEX CLEANUP
    // ======================================================

    const vacancyIndexes = await Vacancy.collection.indexes();

    console.log(
      "Current vacancy indexes:",
      vacancyIndexes.map((index) => index.name),
    );

    const oldVacancyIndex = vacancyIndexes.find(
      (index) => index.name === "vacancy_id_1",
    );

    if (oldVacancyIndex) {
      await Vacancy.collection.dropIndex("vacancy_id_1");

      console.log("✅ Removed old vacancy_id_1 index");
    }

    // ======================================================
    // CURRENT VACANCY INDEXES
    // ======================================================

    await Vacancy.init();

    console.log("✅ Vacancy indexes ready");

    // ======================================================
    // LEGACY PROFILE INDEX CLEANUP
    // ======================================================
    //
    // OLD PROFILE MODEL:
    // user
    //
    // CURRENT PROFILE MODEL:
    // registerId
    //
    // Old unique index:
    // user_1
    //
    // causes:
    //
    // E11000 duplicate key
    // user: null
    //
    // ======================================================

    const profileIndexes = await Profile.collection.indexes();

    console.log(
      "Current profile indexes:",
      profileIndexes.map((index) => index.name),
    );

    const oldProfileUserIndex = profileIndexes.find(
      (index) => index.name === "user_1",
    );

    if (oldProfileUserIndex) {
      await Profile.collection.dropIndex("user_1");

      console.log("✅ Removed old profile user_1 index");
    }

    // ======================================================
    // CURRENT PROFILE INDEXES
    // ======================================================

    await Profile.init();
    await bootstrapAdmin();

    console.log("✅ Profile indexes ready");

    // ======================================================
    // START SERVER
    // ======================================================

    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Startup error:", error);

    process.exit(1);
  }
};

startServer();
