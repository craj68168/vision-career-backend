const Profile = require("../../models/providers/profileSchema");

const Register = require("../../models/providers/registerSchema");

// ======================================================
// REQUIRED PROFILE FIELDS
// ======================================================

const REQUIRED_PROFILE_FIELDS = [
  {
    field: "companyName",
    label: "Company Name",
  },
  {
    field: "phone",
    label: "Phone Number",
  },
  {
    field: "address",
    label: "Address",
  },
  {
    field: "industry",
    label: "Industry",
  },
  {
    field: "contact_person",
    label: "Contact Person",
  },
  {
    field: "contact_person_phone",
    label: "Contact Person Phone",
  },
  {
    field: "contact_person_email",
    label: "Contact Person Email",
  },
];

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

const cleanValue = (value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
};

// ======================================================
// FORMAT RESPONSE
// ======================================================

const formatProfileResponse = (register, profile) => {
  const combinedProfile = {
    registerId: register.registerId,

    name: register.name,

    companyName: profile.company_name || register.companyName || null,

    email: register.email,

    phone: profile.phone || null,

    address: profile.address || null,

    website: profile.website || null,

    industry: profile.industry || null,

    contact_person: profile.contact_person || null,

    contact_person_phone: profile.contact_person_phone || null,

    contact_person_email: profile.contact_person_email || null,

    hiring_needs: profile.hiring_needs || null,

    notes: profile.notes || null,

    status: profile.status || null,

    createdAt: profile.createdAt,

    updatedAt: profile.updatedAt,
  };

  const missingFields = REQUIRED_PROFILE_FIELDS.filter(({ field }) => {
    const value = combinedProfile[field];

    return value === null || value === undefined || value === "";
  });

  const completed = REQUIRED_PROFILE_FIELDS.length - missingFields.length;

  const completionPercentage = Math.round(
    (completed / REQUIRED_PROFILE_FIELDS.length) * 100,
  );

  return {
    is_complete: missingFields.length === 0,

    completion_percentage: completionPercentage,

    missing_fields: missingFields,

    profile: combinedProfile,
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

    // --------------------------------------------------
    // Update account-level company name
    // --------------------------------------------------

    if (req.body.companyName !== undefined) {
      register.companyName = cleanValue(req.body.companyName);
    }

    await register.save();

    // --------------------------------------------------
    // Find/create profile
    // --------------------------------------------------

    let profile = await Profile.findOne({
      registerId,
    });

    if (!profile) {
      profile = new Profile({
        registerId,
      });
    }

    // Always synchronize account fields
    profile.name = register.name;

    profile.company_name = register.companyName;

    profile.email = register.email;

    // --------------------------------------------------
    // Profile fields
    // --------------------------------------------------

    PROFILE_UPDATE_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) {
        profile[field] = cleanValue(req.body[field]);
      }
    });

    await profile.save();

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
