const jwt = require("jsonwebtoken");

const Register = require("../models/providers/registerSchema");
const Profile = require("../models/providers/profileSchema");

// ======================================================
// PROVIDER AUTHENTICATION
// ======================================================
//
// Expected JWT:
//
// {
//   id: MongoDB ObjectId,
//   registerId: "r-000001",
//   role: "provider"
// }
//
// Canonical Provider identifier:
//
// registerId
//
// After authentication:
//
// req.registerId
// req.user
// req.provider
//
// ======================================================

const providerAuth = async (req, res, next) => {
  try {
    // ==================================================
    // AUTHORIZATION HEADER
    // ==================================================

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        status: "error",
        message: "Provider authentication required.",
      });
    }

    // ==================================================
    // TOKEN
    // ==================================================

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        status: "error",
        message: "Authentication token is missing.",
      });
    }

    // ==================================================
    // JWT SECRET
    // ==================================================

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing in .env");

      return res.status(500).json({
        status: "error",
        message: "Authentication configuration error.",
      });
    }

    // ==================================================
    // VERIFY TOKEN
    // ==================================================

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ==================================================
    // CHECK ROLE
    // ==================================================

    if (decoded.role !== "provider") {
      return res.status(403).json({
        status: "error",
        message: "Provider access only.",
      });
    }

    // ==================================================
    // REGISTER ID
    // ==================================================

    const registerId = decoded.registerId;

    if (!registerId) {
      return res.status(401).json({
        status: "error",
        message: "Invalid provider authentication token.",
      });
    }

    // ==================================================
    // CONFIRM PROVIDER STILL EXISTS
    // ==================================================

    const provider = await Register.findOne({
      registerId,
      role: "provider",
    }).select("_id registerId name companyName email role createdAt updatedAt");

    if (!provider) {
      return res.status(401).json({
        status: "error",
        message: "Provider account no longer exists.",
      });
    }

    // ==================================================
    // GET PROVIDER STATUS
    // ==================================================

    const profile = await Profile.findOne({
      registerId,
    }).select("status");

    /*
      Older provider accounts may not have had a Profile
      document.

      For backward compatibility we treat those accounts
      as active.

      All newly-created providers now automatically get a
      Profile.
    */

    const accountStatus = profile?.status || "active";

    // ==================================================
    // BLOCK SUSPENDED PROVIDER
    // ==================================================

    if (accountStatus === "suspended") {
      return res.status(403).json({
        status: "suspended",
        message:
          "Your provider account has been suspended. Please contact the administrator.",
      });
    }

    // ==================================================
    // BLOCK INACTIVE PROVIDER
    // ==================================================

    if (accountStatus === "inactive") {
      return res.status(403).json({
        status: "inactive",
        message: "Your provider account is currently inactive.",
      });
    }

    // ==================================================
    // SAFETY CHECK
    // ==================================================

    if (accountStatus !== "active") {
      return res.status(403).json({
        status: "error",
        message: "Provider account is not active.",
      });
    }

    // ==================================================
    // ATTACH AUTHENTICATED PROVIDER
    // ==================================================

    req.registerId = registerId;

    req.provider = provider;

    req.user = {
      id: provider._id.toString(),
      registerId: provider.registerId,
      role: "provider",
      status: accountStatus,
    };

    // ==================================================
    // TEMPORARY BACKWARD-COMPATIBILITY ALIAS
    // ==================================================
    //
    // Some older controller code may still read:
    //
    // req.providerId
    //
    // Our real Provider identifier is registerId.
    //
    // This can be removed after all controllers have been
    // converted to req.registerId.
    //
    // ==================================================

    req.providerId = registerId;

    // ==================================================
    // CONTINUE
    // ==================================================

    return next();
  } catch (error) {
    console.error("Provider authentication error:", error);

    // ==================================================
    // EXPIRED TOKEN
    // ==================================================

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        status: "error",
        message: "Your session has expired. Please log in again.",
      });
    }

    // ==================================================
    // INVALID TOKEN
    // ==================================================

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        status: "error",
        message: "Invalid authentication token.",
      });
    }

    return res.status(500).json({
      status: "error",
      message: "Provider authentication failed.",
    });
  }
};

module.exports = providerAuth;
