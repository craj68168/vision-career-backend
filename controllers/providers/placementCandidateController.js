const PlacementCandidate = require("../../models/placements/placementCandidateSchema");

const {
  ensurePlacementBilling,
} = require("../../utils/ensurePlacementBilling");

const Recruit = require("../../models/providers/recruitSchema");

const {
  syncSeekerPlacementStatus,
} = require("../../utils/syncSeekerPlacementStatus");

// ======================================================
// PROVIDER-SAFE CANDIDATE SNAPSHOT
//
// REQUIREMENTS:
//
// Provider MAY see:
// - candidate name
// - education
// - experience
// - skills
// - visa status
// - Japanese level
// - other professional profile information
//
// Provider MUST NOT receive:
// - seekerId
// - email
// - phone
// - full/home address
// - exact current location
// - private documents
// - raw internal candidate snapshot
//
// Admin / authorized Staff continue using the original
// stored candidate_snapshot through their own endpoints.
// ======================================================

const serializeProviderCandidateSnapshot = (candidate) => {
  const snapshot = candidate.candidate_snapshot || {};

  return {
    // Candidate name is explicitly Provider-visible.
    name: snapshot.name || null,

    nationality: snapshot.nationality || null,

    // Exact current location stays private.
    current_location: null,

    visa_type: snapshot.visa_type || null,

    visa_expiry_date: snapshot.visa_expiry_date || null,

    japanese_level: snapshot.japanese_level || null,

    skills: Array.isArray(snapshot.skills) ? snapshot.skills : [],

    desired_job: snapshot.desired_job || null,

    // Desired location is professional preference data,
    // not the candidate's home/current address.
    desired_location: snapshot.desired_location || null,

    // ==================================================
    // EDUCATION
    //
    // Education is professional information and may be
    // shown to the Provider, including school name.
    // ==================================================

    education: Array.isArray(snapshot.education)
      ? snapshot.education.map((education) => ({
          enrollment_date: education.enrollment_date || null,

          graduation_date: education.graduation_date || null,

          school_type: education.school_type || null,

          school: education.school || null,

          major: education.major || null,
        }))
      : [],

    // ==================================================
    // EMPLOYMENT HISTORY
    //
    // Professional employment experience may be shown,
    // including previous company name.
    // ==================================================

    employment_history: Array.isArray(snapshot.employment_history)
      ? snapshot.employment_history.map((employment) => ({
          start_date: employment.start_date || null,

          end_date: employment.end_date || null,

          employment_type: employment.employment_type || null,

          company_name: employment.company_name || null,
        }))
      : [],
  };
};

// ======================================================
// PROVIDER SERIALIZER
//
// Never send:
// - candidate.seekerId
// - candidate.providerId
// - raw candidate_snapshot
// - internal Admin matching information
// ======================================================

const serializeProviderCandidate = (candidate) => ({
  placementCandidateId: candidate.placementCandidateId,

  recruitId: candidate.recruitId,

  status: candidate.status,

  candidate: serializeProviderCandidateSnapshot(candidate),

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

    // ==================================================
    // INTERNAL SEEKER ID
    //
    // Used internally only.
    // Never returned to Provider.
    // ==================================================

    const seekerId = candidate.seekerId;

    // ==================================================
    // CONFIRM PROVIDER OWNS REQUEST
    // ==================================================

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

    // ==================================================
    // TRANSITION
    // ==================================================

    const nextStatuses = ALLOWED_TRANSITIONS[candidate.status] || [];

    if (!nextStatuses.includes(status)) {
      return res.status(409).json({
        success: false,

        message: `Cannot change candidate status from ${candidate.status} to ${status}.`,
      });
    }

    // ==================================================
    // REJECT
    // ==================================================

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

    // ==================================================
    // TIMESTAMPS
    // ==================================================

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

    // ==================================================
    // SEEKER PLACEMENT STATUS
    //
    // Internal only.
    // ==================================================

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
