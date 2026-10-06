// ======================================================
// SEEKER PROFILE COMPLETION / PLACEMENT ELIGIBILITY
// ======================================================

const REQUIRED_PROFILE_FIELDS = [
  {
    field: "phone",
    label: "Phone Number",
  },
  {
    field: "address",
    label: "Address",
  },
  {
    field: "current_location",
    label: "Current Location",
  },
  {
    field: "date_of_birth",
    label: "Date of Birth",
  },
  {
    field: "gender",
    label: "Gender",
  },
  {
    field: "nationality",
    label: "Nationality",
  },
  {
    field: "visa_type",
    label: "Visa Type",
  },
  {
    field: "japanese_level",
    label: "Japanese Level",
  },
  {
    field: "skills",
    label: "Skills",
  },
  {
    field: "desired_job",
    label: "Desired Job",
  },
  {
    field: "desired_location",
    label: "Desired Location",
  },
  {
    field: "available_from",
    label: "Available From",
  },
  {
    field: "resume_file",
    label: "Resume File",
  },
  {
    field: "education",
    label: "Educational Background",
  },
];

// ======================================================
// HAS VALUE
// ======================================================

const hasValue = (value) => {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return value !== undefined && value !== null;
};

// ======================================================
// CALCULATE PROFILE COMPLETION
// ======================================================

const calculateProfileCompletion = (seeker) => {
  const missingFields = [];

  REQUIRED_PROFILE_FIELDS.forEach(({ field, label }) => {
    if (!hasValue(seeker[field])) {
      missingFields.push({
        field,
        label,
      });
    }
  });

  const totalFields = REQUIRED_PROFILE_FIELDS.length;
  const completedFields = totalFields - missingFields.length;

  const completionPercentage =
    totalFields === 0 ? 100 : Math.round((completedFields / totalFields) * 100);

  return {
    isComplete: missingFields.length === 0,
    completionPercentage,
    missingFields,
  };
};

// ======================================================
// CALCULATE PLACEMENT ELIGIBILITY
// ======================================================

const calculatePlacementEligibility = (seeker) => {
  const profile = calculateProfileCompletion(seeker);
  const reasons = [];

  if (seeker.approval_status !== "approved") {
    reasons.push({
      code: "ACCOUNT_NOT_APPROVED",
      message: "Seeker account has not been approved.",
    });
  }

  if (seeker.account_status !== "active") {
    reasons.push({
      code: "ACCOUNT_NOT_ACTIVE",
      message: "Seeker account is not active.",
    });
  }

  if (!profile.isComplete) {
    reasons.push({
      code: "PROFILE_INCOMPLETE",
      message: "Seeker profile is incomplete.",
    });
  }

  return {
    isEligible: reasons.length === 0,
    status: reasons.length === 0 ? "ELIGIBLE" : "NOT_ELIGIBLE",
    reasons,
    profile,
  };
};

module.exports = {
  REQUIRED_PROFILE_FIELDS,
  calculateProfileCompletion,
  calculatePlacementEligibility,
};
