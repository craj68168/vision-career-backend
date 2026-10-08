const PlacementCandidate = require("../../models/placements/placementCandidateSchema");

const Recruit = require("../../models/providers/recruitSchema");

const Seeker = require("../../models/seekers/seekerSchema");

const {
  ensurePlacementBilling,
} = require("../../utils/ensurePlacementBilling");

const {
  syncSeekerPlacementStatus,
} = require("../../utils/syncSeekerPlacementStatus");

const {
  sendProviderCandidatePhoto,
} = require("../../utils/providerCandidatePhotoStorage");

// ======================================================
// PROVIDER-SAFE CANDIDATE SNAPSHOT
//
// PROVIDER MAY SEE:
//
// - candidate name
// - candidate photo availability
// - education
// - experience
// - skills
// - visa status
// - Japanese level
// - desired job
// - desired location
// - other professional profile information
//
// PROVIDER MUST NOT RECEIVE:
//
// - seekerId
// - email
// - phone
// - full/home address
// - exact current location
// - private documents
// - raw profile photo storage reference
// - raw internal candidate snapshot
//
// Admin / authorized Staff continue using the original
// candidate_snapshot through their own endpoints.
// ======================================================

const serializeProviderCandidateSnapshot = (candidate, seeker = null) => {
  const snapshot = candidate.candidate_snapshot || {};

  return {
    // ==================================================
    // BASIC PROFILE
    // ==================================================

    name: snapshot.name || null,

    // ==================================================
    // PROTECTED PHOTO
    //
    // Provider receives only whether a photo exists.
    //
    // Actual image is loaded through:
    //
    // GET
    // /api/providers/placement-candidates/
    // :placementCandidateId/photo
    //
    // NEVER return:
    //
    // seeker.profile_photo
    // ==================================================

    photo_available: Boolean(seeker?.profile_photo),

    nationality: snapshot.nationality || null,

    // ==================================================
    // CURRENT LOCATION
    //
    // Exact current location remains private.
    // ==================================================

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
    // ==================================================

    education: Array.isArray(snapshot.education)
      ? snapshot.education.map((education) => ({
          enrollment_date: education?.enrollment_date || null,

          graduation_date: education?.graduation_date || null,

          school_type: education?.school_type || null,

          school: education?.school || null,

          major: education?.major || null,
        }))
      : [],

    // ==================================================
    // EMPLOYMENT HISTORY
    // ==================================================

    employment_history: Array.isArray(snapshot.employment_history)
      ? snapshot.employment_history.map((employment) => ({
          start_date: employment?.start_date || null,

          end_date: employment?.end_date || null,

          employment_type: employment?.employment_type || null,

          company_name: employment?.company_name || null,
        }))
      : [],
  };
};

// ======================================================
// PROVIDER SERIALIZER
//
// NEVER SEND:
//
// - candidate.seekerId
// - candidate.providerId
// - raw candidate_snapshot
// - private photo storage information
// - internal Admin matching information
// ======================================================

const serializeProviderCandidate = (candidate, seeker = null) => ({
  placementCandidateId: candidate.placementCandidateId,

  recruitId: candidate.recruitId,

  status: candidate.status,

  candidate: serializeProviderCandidateSnapshot(candidate, seeker),

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
// LOAD RELATED SEEKERS
//
// Used internally only.
//
// Provider response never receives:
//
// - seekerId
// - profile_photo
// - raw storage reference
// ======================================================

const loadSeekerMap = async (candidates) => {
  const seekerIds = [
    ...new Set(
      candidates.map((candidate) => candidate.seekerId).filter(Boolean),
    ),
  ];

  if (seekerIds.length === 0) {
    return new Map();
  }

  const seekers = await Seeker.find({
    seeker_id: {
      $in: seekerIds,
    },
  })
    .select("seeker_id profile_photo")
    .lean();

  return new Map(seekers.map((seeker) => [seeker.seeker_id, seeker]));
};

// ======================================================
// STATUS TRANSITIONS
//
// IMPORTANT:
//
// UNDER_REVIEW -> INTERVIEW
//
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
// GET ALL PROVIDER PLACEMENT CANDIDATES
//
// GET:
//
// /api/providers/placement-candidates
//
// Optional:
//
// ?recruitId=R-XXXXXX
// ======================================================

exports.getPlacementCandidates = async (req, res) => {
  try {
    const providerId = req.registerId;

    // ==================================================
    // AUTH
    // ==================================================

    if (!providerId) {
      return res.status(401).json({
        success: false,

        message: "Provider authentication required.",
      });
    }

    // ==================================================
    // FILTER
    // ==================================================

    const filter = {
      providerId,
    };

    if (req.query.recruitId) {
      filter.recruitId = req.query.recruitId;
    }

    // ==================================================
    // LOAD CANDIDATES
    // ==================================================

    const candidates = await PlacementCandidate.find(filter).sort({
      createdAt: -1,
    });

    // ==================================================
    // LOAD PHOTO AVAILABILITY
    //
    // Internal use only.
    // ==================================================

    const seekerMap = await loadSeekerMap(candidates);

    // ==================================================
    // SAFE RESPONSE
    // ==================================================

    const data = candidates.map((candidate) =>
      serializeProviderCandidate(
        candidate,

        seekerMap.get(candidate.seekerId),
      ),
    );

    return res.status(200).json({
      success: true,

      count: data.length,

      data,
    });
  } catch (error) {
    console.error(
      "GET PROVIDER PLACEMENT CANDIDATES ERROR:",

      error,
    );

    return res.status(500).json({
      success: false,

      message: "Failed to load matched candidates.",
    });
  }
};

// ======================================================
// GET ONE PROVIDER PLACEMENT CANDIDATE
//
// GET:
//
// /api/providers/placement-candidates/:placementCandidateId
// ======================================================

exports.getPlacementCandidateById = async (req, res) => {
  try {
    const providerId = req.registerId;

    const { placementCandidateId } = req.params;

    // ==================================================
    // AUTH
    // ==================================================

    if (!providerId) {
      return res.status(401).json({
        success: false,

        message: "Provider authentication required.",
      });
    }

    // ==================================================
    // CANDIDATE + OWNERSHIP
    // ==================================================

    const candidate = await PlacementCandidate.findOne({
      placementCandidateId,

      providerId,
    });

    if (!candidate) {
      return res.status(404).json({
        success: false,

        message: "Matched candidate not found.",
      });
    }

    // ==================================================
    // CONFIRM PROVIDER OWNS RECRUIT
    //
    // Defense in depth.
    // ==================================================

    const recruit = await Recruit.findOne({
      recruitId: candidate.recruitId,

      company_id: providerId,
    })
      .select("recruitId")
      .lean();

    if (!recruit) {
      return res.status(404).json({
        success: false,

        message: "Matched candidate not found.",
      });
    }

    // ==================================================
    // PHOTO AVAILABILITY
    //
    // Internal only.
    // ==================================================

    const seeker = candidate.seekerId
      ? await Seeker.findOne({
          seeker_id: candidate.seekerId,
        })
          .select("seeker_id profile_photo")
          .lean()
      : null;

    // ==================================================
    // SAFE RESPONSE
    // ==================================================

    return res.status(200).json({
      success: true,

      data: serializeProviderCandidate(candidate, seeker),
    });
  } catch (error) {
    console.error(
      "GET PROVIDER PLACEMENT CANDIDATE ERROR:",

      error,
    );

    return res.status(500).json({
      success: false,

      message: "Failed to load matched candidate.",
    });
  }
};

// ======================================================
// GET PROTECTED PLACEMENT CANDIDATE PHOTO
//
// GET:
//
// /api/providers/placement-candidates/
// :placementCandidateId/photo
//
// SECURITY FLOW:
//
// Provider authentication
//        ↓
// Candidate belongs to provider
//        ↓
// Placement request belongs to provider
//        ↓
// Internal seekerId lookup
//        ↓
// Private profile_photo lookup
//        ↓
// Secure storage utility
//        ↓
// Image bytes only
//
// NEVER RETURNS:
//
// - seekerId
// - providerId
// - profile_photo
// - storage URL
// - storage key
// - private bucket information
// ======================================================

exports.getPlacementCandidatePhoto = async (req, res) => {
  try {
    const providerId = req.registerId;

    const { placementCandidateId } = req.params;

    // ==================================================
    // AUTH
    // ==================================================

    if (!providerId) {
      return res.status(401).json({
        success: false,

        message: "Provider authentication required.",
      });
    }

    // ==================================================
    // CANDIDATE OWNERSHIP
    // ==================================================

    const candidate = await PlacementCandidate.findOne({
      placementCandidateId,

      providerId,
    })
      .select(
        ["placementCandidateId", "recruitId", "seekerId", "providerId"].join(
          " ",
        ),
      )
      .lean();

    if (!candidate) {
      // Use 404 instead of exposing whether another
      // provider's candidate exists.

      return res.status(404).json({
        success: false,

        message: "Matched candidate not found.",
      });
    }

    // ==================================================
    // PLACEMENT REQUEST OWNERSHIP
    //
    // Defense in depth.
    // ==================================================

    const recruit = await Recruit.findOne({
      recruitId: candidate.recruitId,

      company_id: providerId,
    })
      .select("recruitId")
      .lean();

    if (!recruit) {
      return res.status(404).json({
        success: false,

        message: "Matched candidate not found.",
      });
    }

    // ==================================================
    // INTERNAL SEEKER
    // ==================================================

    if (!candidate.seekerId) {
      return res.status(404).json({
        success: false,

        message: "Candidate photo is not available.",
      });
    }

    const seeker = await Seeker.findOne({
      seeker_id: candidate.seekerId,
    })
      .select("seeker_id profile_photo")
      .lean();

    if (!seeker || !seeker.profile_photo) {
      return res.status(404).json({
        success: false,

        message: "Candidate photo is not available.",
      });
    }

    // ==================================================
    // PRIVATE IMAGE STREAM
    //
    // Reuse the same secured storage utility already used
    // by normal provider applications.
    // ==================================================

    await sendProviderCandidatePhoto({
      res,

      storedPath: seeker.profile_photo,

      seekerId: seeker.seeker_id,
    });

    return undefined;
  } catch (error) {
    console.error(
      "PROVIDER PLACEMENT CANDIDATE PHOTO ERROR:",

      error,
    );

    if (res.headersSent) {
      return undefined;
    }

    const statusCode =
      error.statusCode || error.$metadata?.httpStatusCode || 500;

    return res.status(statusCode).json({
      success: false,

      message:
        statusCode === 404
          ? "Candidate photo not found."
          : statusCode === 403
            ? "Candidate photo access denied."
            : "Failed to load candidate photo.",
    });
  }
};

// ======================================================
// UPDATE PROVIDER PLACEMENT CANDIDATE STATUS
//
// PATCH:
//
// /api/providers/placement-candidates/
// :placementCandidateId/status
// ======================================================

exports.updatePlacementCandidateStatus = async (req, res) => {
  try {
    const providerId = req.registerId;

    const { placementCandidateId } = req.params;

    const { status, rejectionReason } = req.body;

    // ==================================================
    // AUTH
    // ==================================================

    if (!providerId) {
      return res.status(401).json({
        success: false,

        message: "Provider authentication required.",
      });
    }

    // ==================================================
    // STATUS REQUIRED
    // ==================================================

    if (!status) {
      return res.status(400).json({
        success: false,

        message: "Candidate status is required.",
      });
    }

    // ==================================================
    // INTERVIEW MUST BE SCHEDULED
    //
    // Direct status update is intentionally blocked.
    // ==================================================

    if (status === "INTERVIEW") {
      return res.status(400).json({
        success: false,

        message: "Schedule the interview using the interview scheduling form.",
      });
    }

    // ==================================================
    // ALLOWED INPUT STATUSES
    // ==================================================

    const allowedStatuses = ["UNDER_REVIEW", "SELECTED", "PLACED", "REJECTED"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,

        message: "Invalid candidate status.",
      });
    }

    // ==================================================
    // LOAD CANDIDATE + PROVIDER OWNERSHIP
    // ==================================================

    const candidate = await PlacementCandidate.findOne({
      placementCandidateId,

      providerId,
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
    //
    // Never returned to Provider.
    // ==================================================

    const seekerId = candidate.seekerId;

    // ==================================================
    // CONFIRM PROVIDER OWNS REQUEST
    // ==================================================

    const recruit = await Recruit.findOne({
      recruitId: candidate.recruitId,

      company_id: providerId,
    });

    if (!recruit) {
      return res.status(403).json({
        success: false,

        message: "You do not have access to this placement request.",
      });
    }

    // ==================================================
    // VALIDATE TRANSITION
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

    // ==================================================
    // SAVE STATUS
    // ==================================================

    candidate.status = status;

    await candidate.save();

    // ==================================================
    // BILLING
    //
    // Create placement billing after PLACED.
    //
    // Billing failure must not rollback successful
    // placement candidate status.
    // ==================================================

    if (status === "PLACED") {
      try {
        await ensurePlacementBilling(candidate);
      } catch (billingError) {
        console.error(
          "AUTO PLACEMENT BILLING ERROR:",

          billingError,
        );
      }
    }

    // ==================================================
    // SEEKER PLACEMENT STATUS
    //
    // Internal only.
    // ==================================================

    const seekerPlacement = await syncSeekerPlacementStatus(seekerId);

    // ==================================================
    // PHOTO AVAILABILITY FOR RESPONSE
    //
    // We load only the fields needed internally.
    // ==================================================

    const seeker = seekerId
      ? await Seeker.findOne({
          seeker_id: seekerId,
        })
          .select("seeker_id profile_photo")
          .lean()
      : null;

    // ==================================================
    // SAFE RESPONSE
    // ==================================================

    return res.status(200).json({
      success: true,

      message: "Candidate status updated.",

      data: serializeProviderCandidate(
        candidate,

        seeker,
      ),

      seekerPlacementStatus: seekerPlacement?.placementStatus || null,
    });
  } catch (error) {
    console.error(
      "UPDATE PROVIDER CANDIDATE STATUS ERROR:",

      error,
    );

    return res.status(500).json({
      success: false,

      message: "Failed to update candidate status.",
    });
  }
};
