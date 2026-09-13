const jwt = require("jsonwebtoken");
const Provider = require("../models/providers/providerSchema");

const providerAuth = async (req, res, next) => {
  try {
    const authorizationHeader = req.headers.authorization;

    if (
      !authorizationHeader ||
      !authorizationHeader.startsWith("Bearer ")
    ) {
      return res.status(401).json({
        status: "error",
        message: "Authentication token is required.",
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured");
    }

    const token = authorizationHeader.split(" ")[1];

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

    if (
      decodedToken.role !== "provider" ||
      !decodedToken.providerId
    ) {
      return res.status(401).json({
        status: "error",
        message: "Invalid provider token.",
      });
    }

    const provider = await Provider.findOne({
      providerId: decodedToken.providerId,
    });

    if (!provider) {
      return res.status(401).json({
        status: "error",
        message: "Provider account was not found.",
      });
    }

    if (
      provider.approval_status !== "approved" ||
      provider.account_status !== "active"
    ) {
      return res.status(403).json({
        status: "error",
        message: "Provider account is not active.",
      });
    }

    req.provider = provider;
    req.providerId = provider.providerId;

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        status: "error",
        message: "Authentication token has expired.",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        status: "error",
        message: "Authentication token is invalid.",
      });
    }

    console.error("Provider authentication error:", error);

    return res.status(500).json({
      status: "error",
      message: "Unable to authenticate provider.",
    });
  }
};

module.exports = providerAuth;