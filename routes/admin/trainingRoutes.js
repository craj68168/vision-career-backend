const express = require("express");

const adminAuth = require("../../middleware/adminAuth");

const trainingUpload = require("../../middleware/trainingUpload");

const {
  getTrainingCategories,

  createTrainingCategory,

  updateTrainingCategory,

  deleteTrainingCategory,

  getTrainingTopics,

  createTrainingTopic,

  getTrainingTopicById,

  updateTrainingTopic,

  deleteTrainingTopic,

  uploadTrainingFile,

  viewTrainingFile,

  deleteTrainingFile,
} = require("../../controllers/admin/trainingController");

const router = express.Router();

// ======================================================
// CATEGORIES
// ======================================================

router.get(
  "/categories",

  adminAuth,

  getTrainingCategories,
);

router.post(
  "/categories",

  adminAuth,

  createTrainingCategory,
);

router.patch(
  "/categories/:categoryId",

  adminAuth,

  updateTrainingCategory,
);

router.delete(
  "/categories/:categoryId",

  adminAuth,

  deleteTrainingCategory,
);

// ======================================================
// TOPICS INSIDE CATEGORY
// ======================================================

router.get(
  "/categories/:categoryId/topics",

  adminAuth,

  getTrainingTopics,
);

router.post(
  "/categories/:categoryId/topics",

  adminAuth,

  createTrainingTopic,
);

// ======================================================
// TOPIC
// ======================================================

router.get(
  "/topics/:topicId",

  adminAuth,

  getTrainingTopicById,
);

router.patch(
  "/topics/:topicId",

  adminAuth,

  updateTrainingTopic,
);

router.delete(
  "/topics/:topicId",

  adminAuth,

  deleteTrainingTopic,
);

// ======================================================
// TOPIC FILE
// ======================================================

router.post(
  "/topics/:topicId/files",

  adminAuth,

  trainingUpload,

  uploadTrainingFile,
);

// ======================================================
// FILE
// ======================================================

router.get(
  "/files/:fileId/view",

  adminAuth,

  viewTrainingFile,
);

router.delete(
  "/files/:fileId",

  adminAuth,

  deleteTrainingFile,
);

module.exports = router;
