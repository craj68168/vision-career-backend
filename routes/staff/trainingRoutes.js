const express = require("express");

const staffAuth = require("../../middleware/staffAuth");

const {
  getTrainingCategories,

  getTrainingTopics,

  getTrainingTopicById,

  viewTrainingFile,
} = require("../../controllers/staff/trainingController");

const router = express.Router();

// ======================================================
// TRAINING VIEW PERMISSION
//
// Requires:
// training:view
// ======================================================

const requireTrainingView = (req, res, next) => {
  const permissions = Array.isArray(req.staff?.permissions)
    ? req.staff.permissions
    : [];

  if (!permissions.includes("training:view")) {
    return res.status(403).json({
      success: false,

      message: "You do not have permission to access Staff Training.",
    });
  }

  return next();
};

// ======================================================
// AUTH + PERMISSION
// ======================================================

router.use(
  staffAuth,

  requireTrainingView,
);

// ======================================================
// CATEGORIES
// ======================================================

router.get(
  "/categories",

  getTrainingCategories,
);

// ======================================================
// CATEGORY TOPICS
// ======================================================

router.get(
  "/categories/:categoryId/topics",

  getTrainingTopics,
);

// ======================================================
// TOPIC DETAILS
// ======================================================

router.get(
  "/topics/:topicId",

  getTrainingTopicById,
);

// ======================================================
// PRIVATE FILE
// ======================================================

router.get(
  "/files/:fileId/view",

  viewTrainingFile,
);

module.exports = router;
