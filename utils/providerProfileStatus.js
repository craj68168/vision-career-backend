const Profile = require("../models/providers/profileSchema");
const Register = require("../models/providers/registerSchema");

// ======================================================
// REQUIRED PROVIDER PROFILE FIELDS
//
// This is the single source of truth for whether a
// Provider is ready to perform recruitment actions.
//
// Website, Hiring Needs and Notes are intentionally
// optional.
// ======================================================

const REQUIRED_PROVIDER_PROFILE_FIELDS = [
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

// ======================================================
// VALUE CHECK
// ======================================================

const hasValue = (value) => {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return true;
};

// ======================================================
// BUILD COMBINED PROFILE
//
// Some Provider information lives in Register while the
// remaining profile information lives in Profile.
//
// companyName comes primarily from Profile but falls back
// to Register for backward compatibility.
// ======================================================

const buildProviderProfile = (register, profile) => {
  return {
    registerId: register?.registerId || null,

    name: register?.name || "",

    companyName: profile?.company_name || register?.companyName || null,

    email: register?.email || "",

    phone: profile?.phone || null,

    address: profile?.address || null,

    website: profile?.website || null,

    industry: profile?.industry || null,

    contact_person: profile?.contact_person || null,

    contact_person_phone: profile?.contact_person_phone || null,

    contact_person_email: profile?.contact_person_email || null,

    hiring_needs: profile?.hiring_needs || null,

    notes: profile?.notes || null,

    status: profile?.status || "active",

    createdAt: profile?.createdAt || null,

    updatedAt: profile?.updatedAt || null,
  };
};

// ======================================================
// CALCULATE COMPLETION
// ======================================================

const calculateProviderProfileCompletion = (register, profile) => {
  const combinedProfile = buildProviderProfile(register, profile);

  const missingFields = REQUIRED_PROVIDER_PROFILE_FIELDS.filter(({ field }) => {
    return !hasValue(combinedProfile[field]);
  });

  const completedFields =
    REQUIRED_PROVIDER_PROFILE_FIELDS.length - missingFields.length;

  const completionPercentage =
    REQUIRED_PROVIDER_PROFILE_FIELDS.length === 0
      ? 100
      : Math.round(
          (completedFields / REQUIRED_PROVIDER_PROFILE_FIELDS.length) * 100,
        );

  return {
    isComplete: missingFields.length === 0,

    completionPercentage,

    missingFields,

    profile: combinedProfile,
  };
};

// ======================================================
// LOAD PROVIDER PROFILE STATUS
//
// Used by middleware and any other backend workflow that
// needs to know whether a Provider profile is complete.
// ======================================================

const getProviderProfileStatus = async (registerId) => {
  if (!registerId) {
    return null;
  }

  const [register, profile] = await Promise.all([
    Register.findOne({
      registerId,
      role: "provider",
    }).select("_id registerId name companyName email role createdAt updatedAt"),

    Profile.findOne({
      registerId,
    }),
  ]);

  if (!register) {
    return null;
  }

  const completion = calculateProviderProfileCompletion(register, profile);

  return {
    register,

    profileDocument: profile,

    ...completion,
  };
};

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  REQUIRED_PROVIDER_PROFILE_FIELDS,

  buildProviderProfile,

  calculateProviderProfileCompletion,

  getProviderProfileStatus,
};
