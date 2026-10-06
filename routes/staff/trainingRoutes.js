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
// AUTHENTICATION
//
// Staff Training is available automatically to every
// authenticated Staff account.
//
// training:view is no longer required.
// ======================================================

router.use(staffAuth);

// ======================================================
// CATEGORIES
// ======================================================

router.get("/categories", getTrainingCategories);

// ======================================================
// CATEGORY TOPICS
// ======================================================

router.get("/categories/:categoryId/topics", getTrainingTopics);

// ======================================================
// TOPIC DETAILS
// ======================================================

router.get("/topics/:topicId", getTrainingTopicById);

// ======================================================
// PRIVATE FILE
// ======================================================

router.get("/files/:fileId/view", viewTrainingFile);

module.exports = router;
