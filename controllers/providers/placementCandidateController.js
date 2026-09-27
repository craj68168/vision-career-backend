const PlacementCandidate = require("../../models/placements/placementCandidateSchema");

const {
  ensurePlacementBilling,
} = require("../../utils/ensurePlacementBilling");

const Recruit = require("../../models/providers/recruitSchema");

const {
  syncSeekerPlacementStatus,
} = require("../../utils/syncSeekerPlacementStatus");

// ======================================================
// SERIALIZER
// ======================================================

const serializeProviderCandidate = (candidate) => ({
  placementCandidateId: candidate.placementCandidateId,

  recruitId: candidate.recruitId,

  status: candidate.status,

  candidate: candidate.candidate_snapshot,

  matchedAt: candidate.matchedAt,

  providerReviewedAt: candidate.providerReviewedAt,

  interviewAt: candidate.interviewAt,

  selectedAt: candidate.selectedAt,

  placedAt: candidate.placedAt,

  rejectedAt: candidate.rejectedAt,

  rejectionReason: candidate.rejectionReason,

  createdAt: candidate.createdAt,

  updatedAt: candidate.updatedAt,
});

// ======================================================
// TRANSITIONS
//
// IMPORTANT:
//
// UNDER_REVIEW -> INTERVIEW
// is intentionally NOT here.
//
// Interview stage is entered only after successful
// interview scheduling.
// ======================================================

const ALLOWED_TRANSITIONS = {
  MATCHED: ["UNDER_REVIEW", "REJECTED"],

  UNDER_REVIEW: ["REJECTED"],

  INTERVIEW: ["SELECTED", "REJECTED"],

  SELECTED: ["PLACED", "REJECTED"],

  PLACED: [],

  REJECTED: [],
};

// ======================================================
// GET ALL
// ======================================================

exports.getPlacementCandidates = async (req, res) => {
  try {
    const providerId = req.registerId;

    const filter = {
      providerId,
    };

    if (req.query.recruitId) {
      filter.recruitId = req.query.recruitId;
    }

    const candidates = await PlacementCandidate.find(filter).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,

      count: candidates.length,

      data: candidates.map(serializeProviderCandidate),
    });
  } catch (error) {
    console.error("GET PROVIDER PLACEMENT CANDIDATES ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load matched candidates.",
    });
  }
};

// ======================================================
// GET ONE
// ======================================================

exports.getPlacementCandidateById = async (req, res) => {
  try {
    const candidate = await PlacementCandidate.findOne({
      placementCandidateId: req.params.placementCandidateId,

      providerId: req.registerId,
    });

    if (!candidate) {
      return res.status(404).json({
        success: false,

        message: "Matched candidate not found.",
      });
    }

    return res.status(200).json({
      success: true,

      data: serializeProviderCandidate(candidate),
    });
  } catch (error) {
    console.error("GET PROVIDER PLACEMENT CANDIDATE ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load matched candidate.",
    });
  }
};

// ======================================================
// UPDATE STATUS
// ======================================================

exports.updatePlacementCandidateStatus = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;

    // ==================================================
    // INTERVIEW MUST BE SCHEDULED
    // ==================================================

    if (status === "INTERVIEW") {
      return res.status(400).json({
        success: false,

        message: "Schedule the interview using the interview scheduling form.",
      });
    }

    const allowedStatuses = ["UNDER_REVIEW", "SELECTED", "PLACED", "REJECTED"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,

        message: "Invalid candidate status.",
      });
    }

    const candidate = await PlacementCandidate.findOne({
      placementCandidateId: req.params.placementCandidateId,

      providerId: req.registerId,
    });

    if (!candidate) {
      return res.status(404).json({
        success: false,

        message: "Matched candidate not found.",
      });
    }

    const seekerId = candidate.seekerId;

    const recruit = await Recruit.findOne({
      recruitId: candidate.recruitId,

      company_id: req.registerId,
    });

    if (!recruit) {
      return res.status(403).json({
        success: false,

        message: "You do not have access to this placement request.",
      });
    }

    const nextStatuses = ALLOWED_TRANSITIONS[candidate.status] || [];

    if (!nextStatuses.includes(status)) {
      return res.status(409).json({
        success: false,

        message: `Cannot change candidate status from ${candidate.status} to ${status}.`,
      });
    }

    if (status === "REJECTED") {
      const normalizedReason = String(rejectionReason || "").trim();

      if (!normalizedReason) {
        return res.status(400).json({
          success: false,

          message: "Rejection reason is required.",
        });
      }

      if (normalizedReason.length > 1000) {
        return res.status(400).json({
          success: false,

          message: "Rejection reason cannot exceed 1000 characters.",
        });
      }

      candidate.rejectionReason = normalizedReason;

      candidate.rejectedAt = new Date();
    } else {
      candidate.rejectionReason = null;

      candidate.rejectedAt = null;
    }

    if (status === "UNDER_REVIEW") {
      candidate.providerReviewedAt = new Date();
    }

    if (status === "SELECTED") {
      candidate.selectedAt = new Date();
    }

    if (status === "PLACED") {
      candidate.placedAt = new Date();
    }

    candidate.status = status;

    await candidate.save();

    // ==================================================
    // BILLING
    // ==================================================

    if (status === "PLACED") {
      try {
        await ensurePlacementBilling(candidate);
      } catch (billingError) {
        console.error("AUTO PLACEMENT BILLING ERROR:", billingError);
      }
    }

    const seekerPlacement = await syncSeekerPlacementStatus(seekerId);

    return res.status(200).json({
      success: true,

      message: "Candidate status updated.",

      data: serializeProviderCandidate(candidate),

      seekerPlacementStatus: seekerPlacement?.placementStatus || null,
    });
  } catch (error) {
    console.error("UPDATE PROVIDER CANDIDATE STATUS ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to update candidate status.",
    });
  }
};
