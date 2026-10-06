// ======================================================
// AUTOMATIC STAFF ACCESS
//
// Automatically available to every authenticated
// active Staff account.
// ======================================================

const AUTOMATIC_STAFF_PERMISSIONS = ["dashboard:view", "training:view"];

// ======================================================
// ASSIGNABLE STAFF PERMISSIONS
// ======================================================

const ASSIGNABLE_STAFF_PERMISSIONS = [
  // ==================================================
  // VACANCIES
  // ==================================================

  "vacancies:view",
  "vacancies:review",
  "vacancies:approval",

  // ==================================================
  // APPLICATIONS
  // ==================================================

  "applications:view",
  "applications:review",
  "applications:approval",

  // ==================================================
  // INTERVIEWS
  // ==================================================

  "interviews:view",
  "interviews:manage",

  // ==================================================
  // PROVIDERS / CLIENTS
  // ==================================================

  "providers:view",
  "providers:manage",

  // ==================================================
  // JOB SEEKERS
  // ==================================================

  "seekers:view",
  "seekers:manage",
  "seekers:approval",

  // ==================================================
  // PLACEMENT REQUESTS
  // ==================================================

  // View placement requests.
  "placement_requests:view",

  // Staff screening:
  // SCREENED / NEEDS_ATTENTION.
  "placement_requests:review",

  // Final request decision:
  // APPROVE / REJECT.
  "placement_requests:approval",

  // Access matched placement candidates and
  // Staff operational candidate review.
  "placement_requests:manage_candidates",

  // ==================================================
  // PLACEMENT BILLING
  // ==================================================

  "billing:view",
  "billing:manage",

  // ==================================================
  // STAFF TRAINING MANAGEMENT
  // ==================================================

  "training:manage",
];

// ======================================================
// ALL RECOGNIZED PERMISSIONS
// ======================================================

const STAFF_PERMISSIONS = [
  ...AUTOMATIC_STAFF_PERMISSIONS,
  ...ASSIGNABLE_STAFF_PERMISSIONS,
];

// ======================================================
// EFFECTIVE STAFF PERMISSIONS
// ======================================================

const getEffectiveStaffPermissions = (permissions = []) => {
  const storedPermissions = Array.isArray(permissions)
    ? permissions.filter((permission) => STAFF_PERMISSIONS.includes(permission))
    : [];

  return [...new Set([...AUTOMATIC_STAFF_PERMISSIONS, ...storedPermissions])];
};

module.exports = {
  STAFF_PERMISSIONS,
  ASSIGNABLE_STAFF_PERMISSIONS,
  AUTOMATIC_STAFF_PERMISSIONS,
  getEffectiveStaffPermissions,
};
