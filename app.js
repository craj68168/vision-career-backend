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

const providerInterviewRoutes = require("./routes/providers/interviewRoutes");

const providerPlacementCandidateRoutes = require("./routes/providers/placementCandidateRoutes");

const providerPlacementBillingRoutes = require("./routes/providers/placementBillingRoutes");

// ======================================================
// SEEKER ROUTES
// ======================================================

const seekerAuthRoutes = require("./routes/seekers/authRoutes");

const seekerProfileRoutes = require("./routes/seekers/profileRoutes");

const seekerApplicationRoutes = require("./routes/seekers/applicationRoutes");

const seekerResumeRoutes = require("./routes/seekers/resumeRoutes");

const seekerVacancyRoutes = require("./routes/seekers/vacancyRoutes");

const seekerDashboardRoutes = require("./routes/seekers/dashboardRoutes");

const seekerInterviewRoutes = require("./routes/seekers/interviewRoutes");

const seekerNotificationRoutes = require("./routes/seekers/notificationRoutes");

// ======================================================
// ADMIN ROUTES
// ======================================================

const adminAuthRoutes = require("./routes/admin/authRoutes");

const adminDashboardRoutes = require("./routes/admin/dashboardRoutes");

const adminApplicationRoutes = require("./routes/admin/applicationRoutes");

const adminInterviewRoutes = require("./routes/admin/interviewRoutes");

const adminVacancyRoutes = require("./routes/admin/vacancyRoutes");

const adminProviderRoutes = require("./routes/admin/providerRoutes");

const adminSeekerRoutes = require("./routes/admin/seekerRoutes");

const adminPlacementRequestRoutes = require("./routes/admin/placementRequestRoutes");

const adminPlacementCandidateRoutes = require("./routes/admin/placementCandidateRoutes");

const adminPlacementBillingRoutes = require("./routes/admin/placementBillingRoutes");

const adminStaffRoutes = require("./routes/admin/staffRoutes");

const adminTrainingRoutes = require("./routes/admin/trainingRoutes");

// ======================================================
// STAFF ROUTES
// ======================================================

const staffAuthRoutes = require("./routes/staff/authRoutes");

const staffDashboardRoutes = require("./routes/staff/dashboardRoutes");

const staffApplicationRoutes = require("./routes/staff/applicationRoutes");

const staffInterviewRoutes = require("./routes/staff/interviewRoutes");

const staffVacancyRoutes = require("./routes/staff/vacancyRoutes");

const staffSeekerRoutes = require("./routes/staff/seekerRoutes");

const staffProviderRoutes = require("./routes/staff/providerRoutes");

const staffPlacementRequestRoutes = require("./routes/staff/placementRequestRoutes");

const staffPlacementCandidateRoutes = require("./routes/staff/placementCandidateRoutes");

const staffPlacementBillingRoutes = require("./routes/staff/placementBillingRoutes");

const staffTrainingRoutes = require("./routes/staff/trainingRoutes");

// ======================================================
// STARTUP MODELS
// ======================================================

const Vacancy = require("./models/providers/vacancySchema");

const Profile = require("./models/providers/profileSchema");

const Interview = require("./models/interviews/interviewSchema");

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
// PROVIDER INTERVIEWS
// ======================================================

app.use("/api/providers/interviews", providerInterviewRoutes);

// ======================================================
// PROVIDER RECRUIT / PLACEMENT REQUESTS
// ======================================================

app.use("/api/providers/recruits", recruitRoutes);

// ======================================================
// PROVIDER PLACEMENT CANDIDATES
// ======================================================

app.use(
  "/api/providers/placement-candidates",
  providerPlacementCandidateRoutes,
);

// ======================================================
// PROVIDER PLACEMENT BILLINGS
// ======================================================

app.use("/api/providers/placement-billings", providerPlacementBillingRoutes);

// ======================================================
// SEEKER PROFILE
// ======================================================

app.use("/api/seekers/profile", seekerProfileRoutes);

// ======================================================
// SEEKER APPLICATIONS
// ======================================================

app.use("/api/seekers/applications", seekerApplicationRoutes);

// ======================================================
// SEEKER INTERVIEWS
// ======================================================

app.use("/api/seekers/interviews", seekerInterviewRoutes);

// ======================================================
// SEEKER NOTIFICATIONS
// ======================================================

app.use("/api/seekers/notifications", seekerNotificationRoutes);

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
// ADMIN INTERVIEWS
// ======================================================

app.use("/api/admin/interviews", adminInterviewRoutes);

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
// ADMIN PLACEMENT REQUESTS
// ======================================================

app.use("/api/admin/placement-requests", adminPlacementRequestRoutes);

// ======================================================
// ADMIN PLACEMENT CANDIDATES
// ======================================================

app.use("/api/admin/placement-candidates", adminPlacementCandidateRoutes);

// ======================================================
// ADMIN PLACEMENT BILLING
// ======================================================

app.use("/api/admin/placement-billings", adminPlacementBillingRoutes);

// ======================================================
// ADMIN STAFF
// ======================================================

app.use("/api/admin/staff", adminStaffRoutes);

// ======================================================
// STAFF AUTH
// ======================================================

app.use("/api/staff/auth", staffAuthRoutes);

// ======================================================
// STAFF DASHBOARD
// ======================================================

app.use("/api/staff/dashboard", staffDashboardRoutes);

// ======================================================
// STAFF APPLICATIONS
// ======================================================

app.use("/api/staff/applications", staffApplicationRoutes);

// ======================================================
// STAFF INTERVIEWS
// ======================================================

app.use("/api/staff/interviews", staffInterviewRoutes);

// ======================================================
// STAFF VACANCIES
// ======================================================

app.use("/api/staff/vacancies", staffVacancyRoutes);

// ======================================================
// STAFF SEEKERS
// ======================================================

app.use("/api/staff/seekers", staffSeekerRoutes);

// ======================================================
// STAFF PROVIDERS
// ======================================================

app.use("/api/staff/providers", staffProviderRoutes);

// ======================================================
// STAFF PLACEMENT REQUESTS
// ======================================================

app.use("/api/staff/placement-requests", staffPlacementRequestRoutes);

// ======================================================
// STAFF PLACEMENT CANDIDATES
// ======================================================

app.use("/api/staff/placement-candidates", staffPlacementCandidateRoutes);

// ======================================================
// STAFF PLACEMENT BILLING
// ======================================================

app.use("/api/staff/placement-billings", staffPlacementBillingRoutes);

// ======================================================
// ADMIN TRAINING
// ======================================================

app.use("/api/admin/training", adminTrainingRoutes);

// ======================================================
// STAFF TRAINING
// ======================================================

app.use("/api/staff/training", staffTrainingRoutes);

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
// INTERVIEW INDEX CHECK
// ======================================================

const isCorrectApplicationInterviewIndex = (index) => {
  if (index.name !== "unique_application_interview") {
    return false;
  }

  if (!index.unique) {
    return false;
  }

  const keys = Object.keys(index.key || {});

  if (keys.length !== 1 || index.key.application_id !== 1) {
    return false;
  }

  const partial = index.partialFilterExpression || {};

  return (
    partial.source_type === "APPLICATION" &&
    partial.application_id?.$type === "string"
  );
};

const isCorrectPlacementInterviewIndex = (index) => {
  if (index.name !== "unique_placement_candidate_interview") {
    return false;
  }

  if (!index.unique) {
    return false;
  }

  const keys = Object.keys(index.key || {});

  if (keys.length !== 1 || index.key.placement_candidate_id !== 1) {
    return false;
  }

  const partial = index.partialFilterExpression || {};

  return (
    partial.source_type === "PLACEMENT" &&
    partial.placement_candidate_id?.$type === "string"
  );
};

// ======================================================
// LEGACY INTERVIEW INDEX CLEANUP
// ======================================================

const cleanupInterviewIndexes = async () => {
  const indexes = await Interview.collection.indexes();


  for (const index of indexes) {
    // MongoDB primary index must never be removed.
    if (index.name === "_id_") {
      continue;
    }

    // Non-unique query indexes are safe.
    if (!index.unique) {
      continue;
    }

    // interview_id is intentionally unique.
    const keyNames = Object.keys(index.key || {});

    const isInterviewIdIndex =
      keyNames.length === 1 && index.key.interview_id === 1;

    if (isInterviewIdIndex) {
      continue;
    }

    // Current valid application interview index.
    if (isCorrectApplicationInterviewIndex(index)) {
      continue;
    }

    // Current valid placement interview index.
    if (isCorrectPlacementInterviewIndex(index)) {
      continue;
    }

    /*
     * Any other UNIQUE interview index is
     * from an older schema or is incompatible
     * with the current relationship model.
     *
     * Examples:
     *
     * seeker_id_1 unique
     *
     * application_id_1 unique without
     * partialFilterExpression
     *
     * placement_candidate_id_1 unique without
     * partialFilterExpression
     */

    console.log(`⚠️ Removing obsolete unique interview index: ${index.name}`);

    console.log("   key:", index.key);

    await Interview.collection.dropIndex(index.name);

    console.log(`✅ Removed obsolete interview index: ${index.name}`);
  }

  // ==================================================
  // CREATE CURRENT SCHEMA INDEXES
  // ==================================================

  await Interview.init();

  const finalIndexes = await Interview.collection.indexes();
};

// ======================================================
// START SERVER
// ======================================================

const startServer = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI missing in .env");
    }

    // ==================================================
    // CONNECT DATABASE
    // ==================================================

    await mongoose.connect(process.env.MONGO_URI);

    console.log("✅ MongoDB connected");

    // ==================================================
    // LEGACY VACANCY INDEX CLEANUP
    // ==================================================

    const vacancyIndexes = await Vacancy.collection.indexes();



    const oldVacancyIndex = vacancyIndexes.find(
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
    // LEGACY PROFILE INDEX CLEANUP
    // ==================================================
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
    // ==================================================

    const profileIndexes = await Profile.collection.indexes();
    const oldProfileUserIndex = profileIndexes.find(
      (index) => index.name === "user_1",
    );

    if (oldProfileUserIndex) {
      await Profile.collection.dropIndex("user_1");

      console.log("✅ Removed old profile user_1 index");
    }

    // ==================================================
    // CURRENT PROFILE INDEXES
    // ==================================================

    await Profile.init();

    console.log("✅ Profile indexes ready");

    // ==================================================
    // INTERVIEW INDEX CLEANUP
    // ==================================================
    //
    // Current rules:
    //
    // APPLICATION
    // one interview per application_id
    //
    // PLACEMENT
    // one interview per placement_candidate_id
    //
    // IMPORTANT:
    //
    // seeker_id must NOT be globally unique.
    //
    // The same seeker can participate in another
    // application or another placement request.
    //
    // ==================================================

    await cleanupInterviewIndexes();

    // ==================================================
    // BOOTSTRAP ADMIN
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
