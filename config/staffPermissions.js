// ======================================================
// AUTOMATIC STAFF ACCESS
//
// These permissions are automatically available to every
// authenticated active Staff account.
//
// They are recognized permissions so old Staff records
// containing them remain valid.
//
// They are NOT shown in the Admin permission assignment UI.
// ======================================================

const AUTOMATIC_STAFF_PERMISSIONS = ["dashboard:view", "training:view"];

// ======================================================
// ASSIGNABLE STAFF PERMISSIONS
//
// These are the permissions that Admin can explicitly
// assign or remove.
// ======================================================

const ASSIGNABLE_STAFF_PERMISSIONS = [
  // ==================================================
  // VACANCIES
  // ==================================================

  "vacancies:view",

  // Staff screening:
  // SCREENED / NEEDS_ATTENTION
  "vacancies:review",

  // Final vacancy decision:
  // APPROVE / REJECT
  "vacancies:approval",

  // ==================================================
  // APPLICATIONS
  // ==================================================

  "applications:view",

  // Staff screening:
  // SCREENED / NEEDS_ATTENTION
  "applications:review",

  // Final application decision:
  // APPROVE / REJECT
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

  // Screening:
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
  //
  // training:manage remains assignable for any current
  // or future management functionality.
  // ==================================================

  "training:manage",
];

// ======================================================
// ALL RECOGNIZED PERMISSIONS
//
// Used by Mongoose schema validation.
//
// Automatic legacy permissions remain here so existing
// Staff documents remain valid.
// ======================================================

const STAFF_PERMISSIONS = [
  ...AUTOMATIC_STAFF_PERMISSIONS,
  ...ASSIGNABLE_STAFF_PERMISSIONS,
];

// ======================================================
// EFFECTIVE STAFF PERMISSIONS
//
// MongoDB stores only explicitly assigned permissions.
//
// At runtime we combine:
//
// automatic permissions
// +
// valid stored permissions
//
// This means Dashboard and Training work automatically
// without storing them in every Staff document.
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
