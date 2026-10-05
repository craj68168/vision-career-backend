// ======================================================
// AUTOMATIC STAFF ACCESS
//
// Automatically available to every authenticated,
// active Staff account.
//
// These values remain recognized so existing Staff
// documents containing them remain valid.
//
// They are not assignable from the Admin Staff form.
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

  // Staff screening:
  // SCREENED / NEEDS_ATTENTION
  "vacancies:review",

  // Vacancy decision:
  // APPROVE / REJECT
  //
  // This does NOT allow publishing or closing.
  "vacancies:approval",

  // ==================================================
  // APPLICATIONS
  // ==================================================

  "applications:view",
  "applications:review",

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

  // Staff screening:
  // SCREENED / NEEDS_ATTENTION
  "seekers:manage",

  // Final registration decision:
  // APPROVE / REJECT
  "seekers:approval",

  // ==================================================
  // PLACEMENT REQUESTS
  // ==================================================

  "placement_requests:view",
  "placement_requests:review",
  "placement_requests:manage_candidates",

  // ==================================================
  // PLACEMENT BILLING
  // ==================================================

  "billing:view",
  "billing:manage",

  // ==================================================
  // STAFF TRAINING MANAGEMENT
  //
  // training:view is automatic.
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
//
// Stored permissions
// +
// automatic permissions
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
