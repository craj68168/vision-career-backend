const { getProviderProfileStatus } = require("../utils/providerProfileStatus");

// ======================================================
// PROVIDER PROFILE COMPLETION GATE
//
// providerAuth must run before this middleware.
//
// Authentication answers:
//
// "Is this a valid and active Provider?"
//
// This middleware answers:
//
// "Has this Provider completed the required company
// profile before performing recruitment actions?"
// ======================================================

const providerProfileComplete = async (req, res, next) => {
  try {
    const registerId = req.registerId;

    if (!registerId) {
      return res.status(401).json({
        success: false,
        status: "error",

        code: "PROVIDER_AUTH_REQUIRED",

        message: "Provider authentication required.",
      });
    }

    const profileStatus = await getProviderProfileStatus(registerId);

    if (!profileStatus) {
      return res.status(404).json({
        success: false,
        status: "error",

        code: "PROVIDER_NOT_FOUND",

        message: "Provider account not found.",
      });
    }

    // ==================================================
    // PROFILE COMPLETE
    // ==================================================

    if (profileStatus.isComplete) {
      req.providerProfileStatus = {
        isComplete: true,

        completionPercentage: profileStatus.completionPercentage,

        missingFields: [],
      };

      return next();
    }

    // ==================================================
    // PROFILE INCOMPLETE
    // ==================================================

    return res.status(403).json({
      success: false,

      status: "error",

      code: "PROVIDER_PROFILE_INCOMPLETE",

      message: "Please complete your company profile before continuing.",

      completion_percentage: profileStatus.completionPercentage,

      missing_fields: profileStatus.missingFields,
    });
  } catch (error) {
    console.error("PROVIDER PROFILE COMPLETION CHECK ERROR:", error);

    return res.status(500).json({
      success: false,

      status: "error",

      code: "PROVIDER_PROFILE_CHECK_FAILED",

      message: "Failed to verify provider profile completion.",
    });
  }
};

module.exports = providerProfileComplete;
