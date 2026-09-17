// ======================================================
// STAFF PERMISSIONS
// ======================================================

const STAFF_PERMISSIONS = [
  // Dashboard
  "dashboard:view",

  // Vacancies
  "vacancies:view",
  "vacancies:review",

  // Applications
  "applications:view",
  "applications:review",

  // Providers / Clients
  "providers:view",
  "providers:manage",

  // Job Seekers
  "seekers:view",
  "seekers:manage",

  // Placement Requests
  "placement_requests:view",
  "placement_requests:review",
  "placement_requests:manage_candidates",

  // Placement Billing
  "billing:view",
  "billing:manage",

  // Staff Training
  "training:view",
  "training:manage",
];

module.exports = {
  STAFF_PERMISSIONS,
};
