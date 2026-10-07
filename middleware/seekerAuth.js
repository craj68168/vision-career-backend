const jwt = require("jsonwebtoken");
const Seeker = require("../models/seekers/seekerSchema");
const { seekerMessage } = require("../utils/seekerMessages");

const t = (req, en, ja) => seekerMessage(req, { en, ja });

// ======================================================
// SEEKER AUTHENTICATION
// ======================================================

const seekerAuth = async (req, res, next) => {
  try {
    // --------------------------------------------------
    // Get Authorization header
    // --------------------------------------------------

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        status: "error",
        message: t(
          req,
          "Authorization token is required",
          "認証トークンが必要です",
        ),
      });
    }

    // --------------------------------------------------
    // Extract token
    // --------------------------------------------------

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        status: "error",
        message: t(
          req,
          "Authorization token is required",
          "認証トークンが必要です",
        ),
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing in .env");

      return res.status(500).json({
        status: "error",
        message: t(
          req,
          "Authentication configuration error.",
          "認証設定エラーが発生しました。",
        ),
      });
    }
    // --------------------------------------------------
    // Verify JWT
    // --------------------------------------------------

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // --------------------------------------------------
    // Check role
    // --------------------------------------------------

    if (decoded.role !== "seeker" || !decoded.seeker_id) {
      return res.status(403).json({
        status: "error",
        message: t(req, "Access denied", "アクセスが拒否されました"),
      });
    }

    // --------------------------------------------------
    // Find current seeker
    // --------------------------------------------------

    const seeker = await Seeker.findOne({
      seeker_id: decoded.seeker_id,
    }).select("seeker_id name email approval_status account_status");

    if (!seeker) {
      return res.status(401).json({
        status: "error",
        message: t(
          req,
          "Seeker account no longer exists",
          "求職者アカウントが存在しません",
        ),
      });
    }

    // --------------------------------------------------
    // Check approval
    // --------------------------------------------------

    if (seeker.approval_status === "pending") {
      return res.status(403).json({
        status: "pending_approval",
        message: t(
          req,
          "Your account is waiting for admin approval.",
          "アカウントは管理者の承認待ちです。",
        ),
      });
    }

    if (seeker.approval_status === "rejected") {
      return res.status(403).json({
        status: "rejected",
        message: t(
          req,
          "Your account has been rejected.",
          "アカウントは却下されました。",
        ),
      });
    }

    // --------------------------------------------------
    // Check account status
    // --------------------------------------------------

    if (seeker.account_status === "suspended") {
      return res.status(403).json({
        status: "suspended",
        message: t(
          req,
          "Your account has been suspended. Please contact support.",
          "アカウントは停止されています。サポートにお問い合わせください。",
        ),
      });
    }

    if (seeker.account_status !== "active") {
      return res.status(403).json({
        status: "inactive",
        message: t(
          req,
          "Your account is currently inactive.",
          "アカウントは現在無効です。",
        ),
      });
    }

    // --------------------------------------------------
    // Attach authenticated seeker
    // --------------------------------------------------

    req.user = {
      seeker_id: seeker.seeker_id,
      role: "seeker",
    };

    next();
  } catch (error) {
    console.error("Seeker authentication error:", error);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        status: "error",
        message: t(req, "Token has expired", "トークンの有効期限が切れています"),
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        status: "error",
        message: t(req, "Invalid token", "トークンが無効です"),
      });
    }

    return res.status(500).json({
      status: "error",
      message: t(req, "Authentication failed", "認証に失敗しました"),
    });
  }
};

module.exports = seekerAuth;
