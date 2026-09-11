const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const profileRoutes = require(
  "./routes/providers/profileRoutes",
);

const seekerAuthRoutes = require(
  "./routes/seekers/authRoutes",
);

const seekerProfileRoutes = require(
  "./routes/seekers/profileRoutes",
);


const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health-check route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Job portal API is running.",
  });
});

// Existing provider profile routes
app.use("/api/profile", profileRoutes);

app.use(
  "/api/seekers/auth",
  seekerAuthRoutes,
);

app.use(
  "/api/seekers/profile",
  seekerProfileRoutes,
);


// Not-found handler
app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error("Unhandled server error:", error);

  return res.status(error.status || 500).json({
    success: false,
    message: error.message || "Internal server error.",
  });
});

const startServer = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing from the .env file");
    }

    await mongoose.connect(process.env.MONGO_URI);

    console.log("✅ MongoDB connected");

    app.listen(PORT, () => {
      console.log(`✅ Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Server startup error:", error.message);
    process.exit(1);
  }
};

startServer();