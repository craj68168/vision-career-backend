const Notification = require("../../models/notifications/notificationSchema");

const { seekerMessage } = require("../../utils/seekerMessages");

const t = (req, en, ja) => seekerMessage(req, { en, ja });

// ======================================================
// POSITIVE INTEGER
// ======================================================

const readPositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(String(value || ""), 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
};

// ======================================================
// NORMALIZE BOOLEAN QUERY
// ======================================================

const readBooleanQuery = (value) => {
  if (typeof value !== "string") {
    return false;
  }

  return ["true", "1", "yes"].includes(value.trim().toLowerCase());
};

// ======================================================
// NOTIFICATION SERIALIZER
// ======================================================

const toSeekerNotification = (notification) => {
  const data = notification?.toObject ? notification.toObject() : notification;

  return {
    notificationId: data.notification_id,

    type: data.type,

    title: data.title,

    message: data.message,

    interview: data.interview
      ? {
          interviewId: data.interview.interview_id || null,

          applicationId: data.interview.application_id || null,

          vacancyId: data.interview.vacancy_id || null,

          companyName: data.interview.company_name || null,

          jobTitle: data.interview.job_title || null,

          interviewDate: data.interview.interview_date || null,

          interviewTime: data.interview.interview_time || null,

          timezone: data.interview.timezone || null,

          interviewMethod: data.interview.interview_method || null,

          meetingLink:
            data.type === "INTERVIEW_CANCELLED"
              ? null
              : data.interview.meeting_link || null,

          notes: data.interview.notes || null,
        }
      : null,

    isRead: Boolean(data.is_read),

    readAt: data.read_at || null,

    createdAt: data.created_at,

    updatedAt: data.updated_at,
  };
};

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

exports.getMyNotifications = async (req, res) => {
  try {
    const seekerId = req.user?.seeker_id;

    if (!seekerId) {
      return res.status(401).json({
        success: false,

        message: t(
          req,
          "Seeker authentication required.",
          "求職者認証が必要です。",
        ),
      });
    }

    // ==================================================
    // PAGINATION
    // ==================================================

    const page = readPositiveInteger(req.query.page, 1);

    const requestedLimit = readPositiveInteger(req.query.limit, 20);

    const limit = Math.min(requestedLimit, 100);

    const skip = (page - 1) * limit;

    const unreadOnly = readBooleanQuery(req.query.unreadOnly);

    // ==================================================
    // QUERY
    // ==================================================

    const query = {
      recipient_type: "seeker",

      recipient_id: seekerId,
    };

    if (unreadOnly) {
      query.is_read = false;
    }

    // ==================================================
    // LOAD
    // ==================================================

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({
          created_at: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      Notification.countDocuments(query),

      Notification.countDocuments({
        recipient_type: "seeker",

        recipient_id: seekerId,

        is_read: false,
      }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    const data = notifications.map(toSeekerNotification);

    return res.status(200).json({
      success: true,

      count: data.length,

      unreadCount,

      pagination: {
        page,

        limit,

        total,

        totalPages,

        hasNextPage: page < totalPages,

        hasPreviousPage: page > 1,
      },

      data,
    });
  } catch (error) {
    console.error("GET SEEKER NOTIFICATIONS ERROR:", error);

    return res.status(500).json({
      success: false,

      message: t(
        req,
        "Failed to load notifications.",
        "通知の読み込みに失敗しました。",
      ),
    });
  }
};

// ======================================================
// MARK ONE NOTIFICATION AS READ
//
// PATCH
// /api/seekers/notifications/:notificationId/read
//
// ======================================================

exports.markNotificationRead = async (req, res) => {
  try {
    const seekerId = req.user?.seeker_id;

    const { notificationId } = req.params;

    if (!seekerId) {
      return res.status(401).json({
        success: false,

        message: t(
          req,
          "Seeker authentication required.",
          "求職者認証が必要です。",
        ),
      });
    }

    // ==================================================
    // FIND OWN NOTIFICATION ONLY
    // ==================================================

    const notification = await Notification.findOne({
      notification_id: notificationId,

      recipient_type: "seeker",

      recipient_id: seekerId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,

        message: t(req, "Notification not found.", "通知が見つかりません。"),
      });
    }

    // ==================================================
    // ALREADY READ
    // ==================================================

    if (notification.is_read) {
      return res.status(200).json({
        success: true,

        message: t(
          req,
          "Notification is already read.",
          "この通知は既に既読です。",
        ),

        data: toSeekerNotification(notification),
      });
    }

    // ==================================================
    // MARK READ
    // ==================================================

    notification.is_read = true;

    notification.read_at = new Date();

    await notification.save();

    return res.status(200).json({
      success: true,

      message: t(
        req,
        "Notification marked as read.",
        "通知を既読にしました。",
      ),

      data: toSeekerNotification(notification),
    });
  } catch (error) {
    console.error("MARK SEEKER NOTIFICATION READ ERROR:", error);

    return res.status(500).json({
      success: false,

      message: t(
        req,
        "Failed to update notification.",
        "通知の更新に失敗しました。",
      ),
    });
  }
};

// ======================================================
// MARK ALL MY NOTIFICATIONS AS READ
//
// PATCH
// /api/seekers/notifications/read-all
//
// ======================================================

exports.markAllNotificationsRead = async (req, res) => {
  try {
    const seekerId = req.user?.seeker_id;

    if (!seekerId) {
      return res.status(401).json({
        success: false,

        message: t(
          req,
          "Seeker authentication required.",
          "求職者認証が必要です。",
        ),
      });
    }

    const now = new Date();

    // ==================================================
    // UPDATE ONLY CURRENT SEEKER
    // ==================================================

    const result = await Notification.updateMany(
      {
        recipient_type: "seeker",

        recipient_id: seekerId,

        is_read: false,
      },
      {
        $set: {
          is_read: true,

          read_at: now,
        },
      },
    );

    return res.status(200).json({
      success: true,

      message: t(
        req,
        "All notifications marked as read.",
        "すべての通知を既読にしました。",
      ),

      data: {
        modifiedCount: result.modifiedCount || 0,

        unreadCount: 0,
      },
    });
  } catch (error) {
    console.error("MARK ALL SEEKER NOTIFICATIONS READ ERROR:", error);

    return res.status(500).json({
      success: false,

      message: t(
        req,
        "Failed to update notifications.",
        "通知の更新に失敗しました。",
      ),
    });
  }
};
