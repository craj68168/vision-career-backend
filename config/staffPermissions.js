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

  "placement_requests:view",
  "placement_requests:review",
  "placement_requests:approval",
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
// PERMISSION DEPENDENCIES
//
// Any action permission listed here automatically
// requires the related View permission.
//
// Example:
//
// vacancies:review
//
// automatically requires:
//
// vacancies:view
// ======================================================

const STAFF_PERMISSION_DEPENDENCIES = {
  // Vacancies
  "vacancies:review": ["vacancies:view"],

  "vacancies:approval": ["vacancies:view"],

  // Applications
  "applications:review": ["applications:view"],

  "applications:approval": ["applications:view"],

  // Interviews
  "interviews:manage": ["interviews:view"],

  // Providers / Clients
  "providers:manage": ["providers:view"],

  // Job Seekers
  "seekers:manage": ["seekers:view"],

  "seekers:approval": ["seekers:view"],

  // Placement Requests
  "placement_requests:review": ["placement_requests:view"],

  "placement_requests:approval": ["placement_requests:view"],

  "placement_requests:manage_candidates": ["placement_requests:view"],

  // Billing
  "billing:manage": ["billing:view"],
};

// ======================================================
// EXPAND PERMISSION DEPENDENCIES
//
// Makes sure required permissions are always included.
//
// This function is recursive-safe, so if we later add:
//
// permission A -> permission B
// permission B -> permission C
//
// all three will be added automatically.
// ======================================================

const expandStaffPermissionDependencies = (permissions = []) => {
  const validPermissions = Array.isArray(permissions)
    ? permissions.filter((permission) => STAFF_PERMISSIONS.includes(permission))
    : [];

  const expanded = new Set(validPermissions);

  const queue = [...expanded];

  while (queue.length > 0) {
    const permission = queue.shift();

    const dependencies = STAFF_PERMISSION_DEPENDENCIES[permission] || [];

    dependencies.forEach((dependency) => {
      if (STAFF_PERMISSIONS.includes(dependency) && !expanded.has(dependency)) {
        expanded.add(dependency);
        queue.push(dependency);
      }
    });
  }

  // Preserve one consistent permission order.
  return STAFF_PERMISSIONS.filter((permission) => expanded.has(permission));
};

// ======================================================
// NORMALIZE ASSIGNABLE PERMISSIONS
//
// Used when Admin creates/updates Staff.
//
// Automatic permissions are intentionally NOT stored.
//
// Dependencies ARE stored.
//
// Example:
// input:
// ["vacancies:review"]
//
// stored:
// ["vacancies:view", "vacancies:review"]
// ======================================================

const normalizeAssignableStaffPermissions = (permissions = []) => {
  const assignablePermissions = Array.isArray(permissions)
    ? permissions.filter((permission) =>
        ASSIGNABLE_STAFF_PERMISSIONS.includes(permission),
      )
    : [];

  const expanded = expandStaffPermissionDependencies(assignablePermissions);

  return ASSIGNABLE_STAFF_PERMISSIONS.filter((permission) =>
    expanded.includes(permission),
  );
};

// ======================================================
// EFFECTIVE STAFF PERMISSIONS
//
// Used by Staff authentication.
//
// Automatic permissions are added at runtime.
//
// Dependencies are also expanded here so OLD Staff
// records with inconsistent permissions continue to work.
//
// Example legacy DB:
//
// ["vacancies:review"]
//
// effective runtime:
//
// [
//   "dashboard:view",
//   "training:view",
//   "vacancies:view",
//   "vacancies:review"
// ]
// ======================================================

const getEffectiveStaffPermissions = (permissions = []) => {
  const storedPermissions = normalizeAssignableStaffPermissions(permissions);

  const combined = [...AUTOMATIC_STAFF_PERMISSIONS, ...storedPermissions];

  return STAFF_PERMISSIONS.filter((permission) =>
    combined.includes(permission),
  );
};

module.exports = {
  STAFF_PERMISSIONS,

  ASSIGNABLE_STAFF_PERMISSIONS,

  AUTOMATIC_STAFF_PERMISSIONS,

  STAFF_PERMISSION_DEPENDENCIES,

  expandStaffPermissionDependencies,

  normalizeAssignableStaffPermissions,

  getEffectiveStaffPermissions,
};
