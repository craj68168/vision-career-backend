const mongoose = require("mongoose");
const Profile = require("../models/profileSchema");

const REQUIRED_FIELDS = [
  { field: "company_name", label: "Company Name" },
  { field: "phone", label: "Phone Number" },
  { field: "address", label: "Address" },
  { field: "industry", label: "Industry" },
  { field: "contact_person", label: "Contact Person" },
  { field: "contact_person_phone", label: "Contact Person Phone" },
  { field: "contact_person_email", label: "Contact Person Email" },
];

const ALLOWED_UPDATE_FIELDS = [
  "company_name",
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

const getUserId = (req) => {
  return req.user?._id || req.user?.id || req.user?.userId;
};

const cleanOptionalValue = (value) => {
  if (typeof value !== "string") return value;

  const cleanedValue = value.trim();
  return cleanedValue === "" ? null : cleanedValue;
};

const getCompletionDetails = (profile) => {
  const missingFields = REQUIRED_FIELDS.filter(({ field }) => {
    const value = profile[field];

    return (
      value === null ||
      value === undefined ||
      (typeof value === "string" && value.trim() === "")
    );
  });

  const completedCount = REQUIRED_FIELDS.length - missingFields.length;

  const completionPercentage = Math.round(
    (completedCount / REQUIRED_FIELDS.length) * 100,
  );

  return {
    is_complete: missingFields.length === 0,
    completion_percentage: completionPercentage,
    missing_fields: missingFields,
  };
};

const formatProfile = (profile) => {
  const data = profile.toObject ? profile.toObject() : profile;

  return {
    id: data._id.toString(),
    name: data.name || "",
    company_name: data.company_name || null,
    email: data.email || "",
    phone: data.phone || null,
    address: data.address || null,
    website: data.website || null,
    industry: data.industry || null,
    contact_person: data.contact_person || null,
    contact_person_phone: data.contact_person_phone || null,
    contact_person_email: data.contact_person_email || null,
    hiring_needs: data.hiring_needs || null,
    notes: data.notes || null,
    status: data.status,
    created_at: data.createdAt,
    updated_at: data.updatedAt,
  };
};

// GET /api/profile
exports.getProfile = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized. Invalid user information.",
      });
    }

    let profile = await Profile.findOne({ user: userId });

    /*
     * Create an empty profile automatically if the authenticated
     * user does not have one yet.
     */
    if (!profile) {
      profile = await Profile.create({
        user: userId,
        name: req.user?.name || "",
        email: req.user?.email || "",
      });
    }

    const completion = getCompletionDetails(profile);

    return res.status(200).json({
      status: "success",
      message: "Company profile retrieved successfully",
      ...completion,
      profile: formatProfile(profile),
    });
  } catch (error) {
    console.error("Get profile error:", error);

    return res.status(500).json({
      status: "error",
      message: "Failed to load company profile",
    });
  }
};

// POST /api/profile
exports.updateProfile = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized. Invalid user information.",
      });
    }

    let profile = await Profile.findOne({ user: userId });

    if (!profile) {
      profile = new Profile({
        user: userId,
        name: req.user?.name || "",
        email: req.user?.email || "",
      });
    }

    /*
     * Company name can be added once, but cannot be changed afterward.
     */
    if (
      profile.company_name &&
      req.body.company_name &&
      req.body.company_name.trim() !== profile.company_name
    ) {
      return res.status(400).json({
        status: "error",
        message: "Company name cannot be changed once it has been set",
      });
    }

    ALLOWED_UPDATE_FIELDS.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        profile[field] = cleanOptionalValue(req.body[field]);
      }
    });

    await profile.save();

    const completion = getCompletionDetails(profile);

    return res.status(200).json({
      status: "success",
      message: "Company profile updated successfully",
      ...completion,
      profile: formatProfile(profile),
    });
  } catch (error) {
    console.error("Update profile error:", error);

    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map(
        (item) => item.message,
      );

      return res.status(400).json({
        status: "error",
        message: validationErrors[0] || "Profile validation failed",
        errors: validationErrors,
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        status: "error",
        message: "A profile already exists for this user",
      });
    }

    return res.status(500).json({
      status: "error",
      message: "Failed to update company profile",
    });
  }
};