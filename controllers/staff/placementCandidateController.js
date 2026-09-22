const PlacementCandidate = require("../../models/placements/placementCandidateSchema");

const Recruit = require("../../models/providers/recruitSchema");

const Register = require("../../models/providers/registerSchema");

// ======================================================
// STAFF REVIEW SERIALIZER
// ======================================================

const serializeStaffReview = (candidate) => ({
  status: candidate.staff_review_status || "NOT_REVIEWED",

  note: candidate.staff_review_note || null,

  reviewedByStaffId: candidate.reviewed_by_staff_id || null,

  reviewedAt: candidate.staff_reviewed_at || null,
});

// ======================================================
// REQUEST CONTEXT
// ======================================================

const serializeRequestContext = (recruit) => {
  if (!recruit) {
    return null;
  }

  return {
    recruitId: recruit.recruitId,

    jobTitle: recruit.job_title,

    jobCategory: recruit.job_category,

    employmentType: recruit.employment_type,

    numberOfPositions: recruit.number_of_positions,

    workLocation: recruit.work_location,

    japaneseLevelRequired: recruit.japanese_level_required,

    visaTypeRequired: recruit.visa_type_required,

    status: recruit.status,
  };
};

// ======================================================
// PROVIDER CONTEXT
// ======================================================

const serializeProviderContext = (provider) => {
  if (!provider) {
    return null;
  }

  return {
    registerId: provider.registerId,

    name: provider.name,

    companyName: provider.companyName,
  };
};

// ======================================================
// CANDIDATE SERIALIZER
//
// Staff is internal, therefore seekerId may be shown.
//
// Still NEVER expose:
//
// email
// phone
// address
// private documents
// resume path
// ======================================================

const serializeCandidate = ({ candidate, recruit, provider }) => ({
  placementCandidateId: candidate.placementCandidateId,

  recruitId: candidate.recruitId,

  providerId: candidate.providerId,

  seekerId: candidate.seekerId,

  matchedByAdminId: candidate.matchedByAdminId,

  status: candidate.status,

  candidate: candidate.candidate_snapshot,

  request: serializeRequestContext(recruit),

  provider: serializeProviderContext(provider),

  staffReview: serializeStaffReview(candidate),

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
// BUILD RELATED MAPS
// ======================================================

const getRelatedMaps = async (candidates) => {
  const recruitIds = [
    ...new Set(
      candidates.map((candidate) => candidate.recruitId).filter(Boolean),
    ),
  ];

  const providerIds = [
    ...new Set(
      candidates.map((candidate) => candidate.providerId).filter(Boolean),
    ),
  ];

  const [recruits, providers] = await Promise.all([
    recruitIds.length > 0
      ? Recruit.find({
          recruitId: {
            $in: recruitIds,
          },
        }).lean()
      : [],

    providerIds.length > 0
      ? Register.find({
          registerId: {
            $in: providerIds,
          },

          role: "provider",
        }).lean()
      : [],
  ]);

  return {
    recruitMap: new Map(
      recruits.map((recruit) => [recruit.recruitId, recruit]),
    ),

    providerMap: new Map(
      providers.map((provider) => [provider.registerId, provider]),
    ),
  };
};

// ======================================================
// GET ALL STAFF PLACEMENT CANDIDATES
//
// GET /api/staff/placement-candidates
//
// Optional:
// ?recruitId=R-XXXXXX
// ======================================================

exports.getStaffPlacementCandidates = async (req, res) => {
  try {
    const filter = {};

    if (req.query.recruitId) {
      filter.recruitId = String(req.query.recruitId).trim();
    }

    const candidates = await PlacementCandidate.find(filter)
      .sort({
        createdAt: -1,
      })
      .lean();

    const { recruitMap, providerMap } = await getRelatedMaps(candidates);

    const data = candidates.map((candidate) =>
      serializeCandidate({
        candidate,

        recruit: recruitMap.get(candidate.recruitId),

        provider: providerMap.get(candidate.providerId),
      }),
    );

    const summary = {
      total: data.length,

      notReviewed: data.filter(
        (item) => item.staffReview.status === "NOT_REVIEWED",
      ).length,

      reviewed: data.filter((item) => item.staffReview.status === "REVIEWED")
        .length,

      needsAttention: data.filter(
        (item) => item.staffReview.status === "NEEDS_ATTENTION",
      ).length,

      matched: data.filter((item) => item.status === "MATCHED").length,

      underReview: data.filter((item) => item.status === "UNDER_REVIEW").length,

      interview: data.filter((item) => item.status === "INTERVIEW").length,

      selected: data.filter((item) => item.status === "SELECTED").length,

      placed: data.filter((item) => item.status === "PLACED").length,

      rejected: data.filter((item) => item.status === "REJECTED").length,
    };

    return res.status(200).json({
      success: true,

      count: data.length,

      summary,

      data,
    });
  } catch (error) {
    console.error("GET STAFF PLACEMENT CANDIDATES ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load placement candidates.",
    });
  }
};

// ======================================================
// GET ONE
//
// GET
// /api/staff/placement-candidates/:placementCandidateId
// ======================================================

exports.getStaffPlacementCandidateById = async (req, res) => {
  try {
    const candidate = await PlacementCandidate.findOne({
      placementCandidateId: req.params.placementCandidateId,
    }).lean();

    if (!candidate) {
      return res.status(404).json({
        success: false,

        message: "Placement candidate not found.",
      });
    }

    const [recruit, provider] = await Promise.all([
      Recruit.findOne({
        recruitId: candidate.recruitId,
      }).lean(),

      Register.findOne({
        registerId: candidate.providerId,

        role: "provider",
      }).lean(),
    ]);

    return res.status(200).json({
      success: true,

      data: serializeCandidate({
        candidate,
        recruit,
        provider,
      }),
    });
  } catch (error) {
    console.error("GET STAFF PLACEMENT CANDIDATE ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load placement candidate.",
    });
  }
};

// ======================================================
// STAFF REVIEW
//
// PATCH
// /api/staff/placement-candidates/:placementCandidateId/review
//
// IMPORTANT:
//
// This endpoint NEVER modifies candidate.status.
// ======================================================

exports.reviewStaffPlacementCandidate = async (req, res) => {
  try {
    const { placementCandidateId } = req.params;

    const { reviewStatus, note } = req.body;

    // ==================================================
    // STATUS
    // ==================================================

    if (!["REVIEWED", "NEEDS_ATTENTION"].includes(reviewStatus)) {
      return res.status(400).json({
        success: false,

        message: "Invalid Staff review status.",
      });
    }

    const normalizedNote = typeof note === "string" ? note.trim() : "";

    // ==================================================
    // ATTENTION REQUIRES NOTE
    // ==================================================

    if (reviewStatus === "NEEDS_ATTENTION" && !normalizedNote) {
      return res.status(400).json({
        success: false,

        message:
          "A review note is required when marking a candidate as needing attention.",
      });
    }

    if (normalizedNote.length > 2000) {
      return res.status(400).json({
        success: false,

        message: "Review note cannot exceed 2000 characters.",
      });
    }

    // ==================================================
    // CANDIDATE
    // ==================================================

    const candidate = await PlacementCandidate.findOne({
      placementCandidateId,
    });

    if (!candidate) {
      return res.status(404).json({
        success: false,

        message: "Placement candidate not found.",
      });
    }

    // ==================================================
    // STAFF REVIEW ONLY
    //
    // Do NOT touch:
    //
    // candidate.status
    // providerReviewedAt
    // interviewAt
    // selectedAt
    // placedAt
    // rejectedAt
    // rejectionReason
    // ==================================================

    candidate.staff_review_status = reviewStatus;

    candidate.staff_review_note = normalizedNote || null;

    candidate.reviewed_by_staff_id = req.staff.staffId;

    candidate.staff_reviewed_at = new Date();

    await candidate.save();

    const [recruit, provider] = await Promise.all([
      Recruit.findOne({
        recruitId: candidate.recruitId,
      }).lean(),

      Register.findOne({
        registerId: candidate.providerId,

        role: "provider",
      }).lean(),
    ]);

    return res.status(200).json({
      success: true,

      message:
        reviewStatus === "REVIEWED"
          ? "Candidate Staff review completed."
          : "Candidate marked as needing attention.",

      data: serializeCandidate({
        candidate: candidate.toObject(),

        recruit,

        provider,
      }),
    });
  } catch (error) {
    console.error("STAFF PLACEMENT CANDIDATE REVIEW ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to save candidate Staff review.",
    });
  }
};
