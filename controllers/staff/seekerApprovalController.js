const Seeker = require("../../models/seekers/seekerSchema");

const Application = require("../../models/applications/applicationSchema");

const { sendSeekerApprovalEmail } = require("../../utils/seekerEmail");

const {
  calculatePlacementEligibility,
} = require("../../utils/seekerProfileStatus");

// ======================================================
// SAFE STAFF RESPONSE
// ======================================================

const serializeSeeker = (seeker, applicationsCount = 0) => {
  const item =
    typeof seeker.toObject === "function"
      ? seeker.toObject()
      : {
          ...seeker,
        };

  delete item.password;

  delete item.password_reset_code_hash;

  delete item.password_reset_code_expires;

  delete item.password_reset_attempts;

  delete item.password_reset_token_hash;

  delete item.password_reset_token_expires;

  delete item.__v;

  const eligibility = calculatePlacementEligibility(seeker);

  return {
    ...item,

    applications_count: applicationsCount,

    staffScreening: {
      status: item.staff_screening_status || "NOT_SCREENED",

      note: item.staff_screening_note || null,

      screenedByStaffId: item.screened_by_staff_id || null,

      screenedAt: item.screened_at || null,
    },

    profile_status: eligibility.profile.isComplete ? "COMPLETE" : "INCOMPLETE",

    completion_percentage: eligibility.profile.completionPercentage,

    missing_fields: eligibility.profile.missingFields,

    placement_eligible: eligibility.isEligible,

    placement_eligibility: {
      status: eligibility.status,

      reasons: eligibility.reasons,
    },
  };
};

// ======================================================
// STAFF APPROVE / REJECT SEEKER
//
// PATCH /api/staff/seekers/:seekerId/approval
// ======================================================

exports.updateStaffSeekerApproval = async (req, res) => {
  try {
    const { seekerId } = req.params;

    const { decision, reason = null } = req.body;

    // ==================================================
    // DECISION
    // ==================================================

    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({
        success: false,

        message: "Decision must be approved or rejected.",
      });
    }

    // ==================================================
    // REJECTION REASON
    // ==================================================

    const normalizedReason = typeof reason === "string" ? reason.trim() : "";

    if (decision === "rejected" && !normalizedReason) {
      return res.status(400).json({
        success: false,

        message: "Rejection reason is required.",
      });
    }

    if (normalizedReason.length > 2000) {
      return res.status(400).json({
        success: false,

        message: "Rejection reason cannot exceed 2000 characters.",
      });
    }

    // ==================================================
    // SEEKER
    // ==================================================

    const seeker = await Seeker.findOne({
      seeker_id: seekerId,
    });

    if (!seeker) {
      return res.status(404).json({
        success: false,

        message: "Job seeker not found.",
      });
    }

    // ==================================================
    // STAFF MAY ONLY DECIDE PENDING REGISTRATIONS
    // ==================================================

    if (seeker.approval_status !== "pending") {
      return res.status(409).json({
        success: false,

        message:
          "Only Job Seekers with pending registration approval can be approved or rejected by Staff.",
      });
    }

    // ==================================================
    // RECORD DECISION
    // ==================================================

    seeker.recordApprovalDecision({
      decision,

      actorType: "staff",

      actorId: req.staff.staffId,

      actorName: req.staff.name,

      reason: normalizedReason,
    });

    await seeker.save();

    // ==================================================
    // APPROVAL EMAIL
    // ==================================================

    let emailSent = false;

    let emailWarning = null;

    if (decision === "approved") {
      try {
        await sendSeekerApprovalEmail(seeker);

        emailSent = true;
      } catch (emailError) {
        console.error("STAFF SEEKER APPROVAL EMAIL ERROR:", emailError);

        emailWarning =
          "The seeker was approved, but the approval email could not be sent.";
      }
    }

    // ==================================================
    // APPLICATION COUNT
    // ==================================================

    const applicationsCount = await Application.countDocuments({
      seeker_id: seekerId,
    });

    return res.status(200).json({
      success: true,

      message:
        decision === "approved"
          ? emailWarning
            ? "Job Seeker approved successfully, but the approval email could not be sent."
            : "Job Seeker approved successfully."
          : "Job Seeker rejected successfully.",

      email_sent: decision === "approved" ? emailSent : null,

      warning: emailWarning,

      data: serializeSeeker(seeker, applicationsCount),
    });
  } catch (error) {
    console.error("STAFF SEEKER APPROVAL ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to update Job Seeker approval.",
    });
  }
};
