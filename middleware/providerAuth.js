const jwt = require("jsonwebtoken");
const Provider = require("../models/providers/registerSchema");

const providerAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Token missing",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { providerId, registerId, role } = decoded;

    if (role !== "provider") {
      return res.status(401).json({
        message: "Invalid role",
      });
    }

    const provider = await Provider.findOne({ providerId });

    if (!provider) {
      return res.status(404).json({
        message: "Provider not found",
      });
    }

    req.provider = provider;

    // 🔥 THIS IS WHAT YOU NEED
    req.registerId = registerId;
    req.providerId = providerId;

    next();
  } catch (err) {
    res.status(401).json({
      message: err.message,
    });
  }
};

module.exports = providerAuth;