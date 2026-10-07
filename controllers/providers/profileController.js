const Profile = require("../../models/providers/profileSchema");
const Register = require("../../models/providers/registerSchema");

const {
  calculateProviderProfileCompletion,
} = require("../../utils/providerProfileStatus");

// ======================================================
// PROFILE UPDATE FIELDS
// ======================================================

const PROFILE_UPDATE_FIELDS = [
  "phone",
  "address",
  "website",
  "industry",
  "contact_person",
  "contact_person_phone",
  "contact_person_email",
  "hiring_needs",
  "notes",
];

// ======================================================
// CLEAN VALUE
// ======================================================

const cleanValue = (value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
};

// ======================================================
// FORMAT RESPONSE
//
// The actual completion rule now lives inside:
//
// utils/providerProfileStatus.js
//
// This prevents Profile, Vacancy and Placement Request
// from having different definitions of "complete".
// ======================================================

const formatProfileResponse = (register, profile) => {
  const profileStatus = calculateProviderProfileCompletion(register, profile);

  return {
    is_complete: profileStatus.isComplete,

    completion_percentage: profileStatus.completionPercentage,

    missing_fields: profileStatus.missingFields,

    profile: profileStatus.profile,
  };
};

// ======================================================
// GET PROFILE
// GET /api/providers/profile
// ======================================================

exports.getProfile = async (req, res) => {
  try {
    const registerId = req.registerId;

    if (!registerId) {
      return res.status(401).json({
        status: "error",

        message: "Provider authentication required",
      });
    }

    const register = await Register.findOne({
      registerId,
    }).select("-password");

    if (!register) {
      return res.status(404).json({
        status: "error",

        message: "Provider account not found",
      });
    }

    let profile = await Profile.findOne({
      registerId,
    });

    // ==================================================
    // BACKWARD COMPATIBILITY
    //
    // Older Providers may not have a Profile document.
    // Create one automatically from Register information.
    // ==================================================

    if (!profile) {
      profile = await Profile.create({
        registerId,

        name: register.name,

        company_name: register.companyName,

        email: register.email,
      });
    }

    const profileData = formatProfileResponse(register, profile);

    return res.status(200).json({
      status: "success",

      message: "Profile fetched successfully",

      ...profileData,
    });
  } catch (error) {
    console.error("GET PROVIDER PROFILE ERROR:", error);

    return res.status(500).json({
      status: "error",

      message: "Failed to load provider profile",
    });
  }
};

// ======================================================
// UPDATE PROFILE
// PATCH /api/providers/profile
// ======================================================

exports.updateProfile = async (req, res) => {
  try {
    const registerId = req.registerId;

    if (!registerId) {
      return res.status(401).json({
        status: "error",

        message: "Provider authentication required",
      });
    }

    const register = await Register.findOne({
      registerId,
    });

    if (!register) {
      return res.status(404).json({
        status: "error",

        message: "Provider account not found",
      });
    }

    // ==================================================
    // UPDATE ACCOUNT-LEVEL COMPANY NAME
    // ==================================================

    if (req.body.companyName !== undefined) {
      register.companyName = cleanValue(req.body.companyName);
    }

    await register.save();

    // ==================================================
    // FIND / CREATE PROFILE
    // ==================================================

    let profile = await Profile.findOne({
      registerId,
    });

    if (!profile) {
      profile = new Profile({
        registerId,
      });
    }

    // ==================================================
    // ALWAYS SYNCHRONIZE REGISTER FIELDS
    // ==================================================

    profile.name = register.name;

    profile.company_name = register.companyName;

    profile.email = register.email;

    // ==================================================
    // PROFILE FIELDS
    // ==================================================

    PROFILE_UPDATE_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) {
        profile[field] = cleanValue(req.body[field]);
      }
    });

    await profile.save();

    // ==================================================
    // CALCULATE FRESH COMPLETION STATUS
    // ==================================================

    const profileData = formatProfileResponse(register, profile);

    return res.status(200).json({
      status: "success",

      message: "Profile updated successfully",

      ...profileData,
    });
  } catch (error) {
    console.error("UPDATE PROVIDER PROFILE ERROR:", error);

    if (error.name === "ValidationError") {
      const firstError = Object.values(error.errors)[0];

      return res.status(400).json({
        status: "error",

        message: firstError.message,
      });
    }

    return res.status(500).json({
      status: "error",

      message: "Failed to update provider profile",
    });
  }
};
