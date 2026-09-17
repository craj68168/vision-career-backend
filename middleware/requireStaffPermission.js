// ======================================================
// REQUIRE STAFF PERMISSION
//
// Example:
//
// router.get(
//   "/",
//   staffAuth,
//   requireStaffPermission("applications:view"),
//   controller,
// );
//
// ======================================================

const requireStaffPermission = (permission) => (req, res, next) => {
  if (!req.staff) {
    return res.status(401).json({
      success: false,

      message: "Staff authentication required.",
    });
  }

  const permissions = req.staff.permissions || [];

  if (!permissions.includes(permission)) {
    return res.status(403).json({
      success: false,

      message: "You do not have permission to perform this action.",
    });
  }

  return next();
};

module.exports = requireStaffPermission;
