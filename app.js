const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");

require("dotenv").config();
const registerRoutes = require("./routes/providers/registerRoutes");

const profileRoutes = require(
  "./routes/providers/profileRoutes",
);

const seekerAuthRoutes = require(
  "./routes/seekers/authRoutes",
);

const seekerProfileRoutes = require(
  "./routes/seekers/profileRoutes",
);

const seekerApplicationRoutes = require(
  "./routes/seekers/applicationRoutes",
);

const seekerResumeRoutes = require(
  "./routes/seekers/resumeRoutes",
);

const app = express();
const PORT = process.env.PORT || 5000;

// ======================================================
// MIDDLEWARE
// ======================================================

app.use(
  cors({
    origin:
      process.env.FRONTEND_URL ||
      "http://localhost:3000",
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================================================
// STATIC UPLOAD FILES
// ======================================================

app.use(
  "/uploads",
  express.static(
    path.join(__dirname, "uploads"),
  ),
);

// ======================================================
// HEALTH CHECK
// ======================================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Job portal API is running.",
  });
});


// ======================================================
// PROVIDER ROUTES
// ======================================================

app.use(
  "/api/profile",
  profileRoutes,
);

// ======================================================
// SEEKER AUTH ROUTES
// ======================================================
app.use(
  "/api/seekers/resume",
  seekerResumeRoutes,
);

app.use(
  "/api/seekers/auth",
  seekerAuthRoutes,
);

// ======================================================
// SEEKER PROFILE ROUTES
// ======================================================

app.use(
  "/api/seekers/profile",
  seekerProfileRoutes,
);

app.use(
  "/api/seekers/applications",
  seekerApplicationRoutes,
);



// Existing provider profile routes
app.use("/api/auth", registerRoutes);
app.use("/api/providers", profileRoutes);





// ======================================================
// NOT FOUND
// ======================================================

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});


// ======================================================
// GLOBAL ERROR HANDLER
// ======================================================

app.use((error, req, res, next) => {
  console.error(
    "Unhandled server error:",
    error,
  );

  return res
    .status(error.status || 500)
    .json({
      success: false,
      message:
        error.message ||
        "Internal server error.",
    });
});


// ======================================================
// START SERVER
// ======================================================

const startServer = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error(
        "MONGO_URI is missing from the .env file",
      );
    }

    await mongoose.connect(
      process.env.MONGO_URI,
    );

    console.log("✅ MongoDB connected");

    app.listen(PORT, () => {
      console.log(
        `✅ Server running at http://localhost:${PORT}`,
      );
    });
  } catch (error) {
    console.error(
      "❌ Server startup error:",
      error.message,
    );

    process.exit(1);
  }
};

startServer();