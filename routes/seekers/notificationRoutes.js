const express = require("express");

const seekerAuth = require("../../middleware/seekerAuth");

const {
  getMyNotifications,

  markNotificationRead,

  markAllNotificationsRead,
} = require("../../controllers/seekers/notificationController");

const router = express.Router();

// ======================================================
// GET MY NOTIFICATIONS
//
// GET
// /api/seekers/notifications
//
// Optional:
//
// ?page=1
// ?limit=20
// ?unreadOnly=true
//
// ======================================================

router.get("/", seekerAuth, getMyNotifications);

// ======================================================
// MARK ALL AS READ
//
// IMPORTANT:
//
// Keep this route before:
//
// /:notificationId/read
//
// ======================================================

router.patch("/read-all", seekerAuth, markAllNotificationsRead);

// ======================================================
// MARK ONE AS READ
//
// PATCH
// /api/seekers/notifications/:notificationId/read
//
// ======================================================

router.patch("/:notificationId/read", seekerAuth, markNotificationRead);

module.exports = router;
