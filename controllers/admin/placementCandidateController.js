const crypto = require("crypto");

const PlacementCandidate = require("../../models/placements/placementCandidateSchema");

const Recruit = require("../../models/providers/recruitSchema");

const Seeker = require("../../models/seekers/seekerSchema");

// ======================================================
// GENERATE PLACEMENT CANDIDATE ID
// ======================================================

const generatePlacementCandidateId = async () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const id = `PC-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    const exists = await PlacementCandidate.exists({
      placementCandidateId: id,
    });

    if (!exists) {
      return id;
    }
  }

  throw new Error("Unable to generate placement candidate ID.");
};

// ======================================================
// BUILD SAFE SNAPSHOT
// ======================================================

const buildCandidateSnapshot = (seeker) => ({
  name: seeker.name,

  nationality: seeker.nationality || null,

  current_location: seeker.current_location || null,

  visa_type: seeker.visa_type || null,

  visa_expiry_date: seeker.visa_expiry_date || null,

  japanese_level: seeker.japanese_level || null,

  skills: Array.isArray(seeker.skills) ? seeker.skills : [],

  desired_job: seeker.desired_job || null,

  desired_location: seeker.desired_location || null,

  education: Array.isArray(seeker.education)
    ? seeker.education.map((education) => ({
        enrollment_date: education.enrollment_date || null,

        graduation_date: education.graduation_date || null,

        school_type: education.school_type || null,

        school: education.school || null,

        major: education.major || null,
      }))
    : [],

  employment_history: Array.isArray(seeker.employment_history)
    ? seeker.employment_history.map((employment) => ({
        start_date: employment.start_date || null,

        end_date: employment.end_date || null,

        employment_type: employment.employment_type || null,

        company_name: employment.company_name || null,
      }))
    : [],
});

// ======================================================
// ADMIN SERIALIZER
// ======================================================

const serializeCandidate = (candidate) => ({
  placementCandidateId: candidate.placementCandidateId,

  recruitId: candidate.recruitId,

  providerId: candidate.providerId,

  seekerId: candidate.seekerId,

  status: candidate.status,

  candidate: candidate.candidate_snapshot,

  matchedByAdminId: candidate.matchedByAdminId,

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
// VERIFY APPROVED PLACEMENT REQUEST
// ======================================================

const getApprovedRecruit = async (recruitId) => {
  return Recruit.findOne({
    recruitId,

    status: "approved",
  });
};

// ======================================================
// GET ELIGIBLE SEEKERS
//
// GET
// /api/admin/placement-candidates/:recruitId/eligible
// ======================================================

exports.getEligibleSeekers = async (req, res) => {
  try {
    const { recruitId } = req.params;

    const recruit = await getApprovedRecruit(recruitId);

    if (!recruit) {
      return res.status(404).json({
        success: false,

        message: "Approved placement request not found.",
      });
    }

    // Already matched to this request
    const matchedSeekerIds = await PlacementCandidate.distinct("seekerId", {
      recruitId,
    });

    const seekers = await Seeker.find({
      approval_status: "approved",

      account_status: "active",

      placement_status: {
        $ne: "placed",
      },

      seeker_id: {
        $nin: matchedSeekerIds,
      },
    })
      .select(
        [
          "seeker_id",
          "name",
          "nationality",
          "current_location",
          "visa_type",
          "visa_expiry_date",
          "japanese_level",
          "skills",
          "desired_job",
          "desired_location",
          "education",
          "employment_history",
          "placement_status",
          "created_at",
        ].join(" "),
      )
      .sort({
        created_at: -1,
      })
      .lean();

    const data = seekers.map((seeker) => ({
      seekerId: seeker.seeker_id,

      name: seeker.name,

      nationality: seeker.nationality || null,

      currentLocation: seeker.current_location || null,

      visaType: seeker.visa_type || null,

      visaExpiryDate: seeker.visa_expiry_date || null,

      japaneseLevel: seeker.japanese_level || null,

      skills: seeker.skills || [],

      desiredJob: seeker.desired_job || null,

      desiredLocation: seeker.desired_location || null,

      education: seeker.education || [],

      employmentHistory: seeker.employment_history || [],

      placementStatus: seeker.placement_status,
    }));

    return res.status(200).json({
      success: true,

      recruit: {
        recruitId: recruit.recruitId,

        jobTitle: recruit.job_title,

        numberOfPositions: recruit.number_of_positions,

        workLocation: recruit.work_location,

        japaneseLevelRequired: recruit.japanese_level_required,

        visaTypeRequired: recruit.visa_type_required,
      },

      count: data.length,

      data,
    });
  } catch (error) {
    console.error("GET ELIGIBLE SEEKERS ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load eligible seekers.",
    });
  }
};

// ======================================================
// GET MATCHED CANDIDATES FOR REQUEST
//
// GET
// /api/admin/placement-candidates/:recruitId
// ======================================================

exports.getMatchedCandidates = async (req, res) => {
  try {
    const { recruitId } = req.params;

    const recruit = await Recruit.findOne({
      recruitId,
    });

    if (!recruit) {
      return res.status(404).json({
        success: false,

        message: "Placement request not found.",
      });
    }

    const candidates = await PlacementCandidate.find({
      recruitId,
    }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,

      count: candidates.length,

      data: candidates.map(serializeCandidate),
    });
  } catch (error) {
    console.error("GET MATCHED CANDIDATES ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load matched candidates.",
    });
  }
};

// ======================================================
// MATCH SEEKER
//
// POST
// /api/admin/placement-candidates/:recruitId/:seekerId
// ======================================================

exports.matchCandidate = async (req, res) => {
  try {
    const { recruitId, seekerId } = req.params;

    // ==================================================
    // APPROVED REQUEST
    // ==================================================

    const recruit = await getApprovedRecruit(recruitId);

    if (!recruit) {
      return res.status(409).json({
        success: false,

        message:
          "Candidates can only be matched to an approved placement request.",
      });
    }

    // ==================================================
    // SEEKER
    // ==================================================

    const seeker = await Seeker.findOne({
      seeker_id: seekerId,

      approval_status: "approved",

      account_status: "active",
    });

    if (!seeker) {
      return res.status(404).json({
        success: false,

        message: "Eligible Job Seeker not found.",
      });
    }

    if (seeker.placement_status === "placed") {
      return res.status(409).json({
        success: false,

        message: "This Job Seeker has already been placed.",
      });
    }

    // ==================================================
    // DUPLICATE
    // ==================================================

    const existing = await PlacementCandidate.findOne({
      recruitId,
      seekerId,
    });

    if (existing) {
      return res.status(409).json({
        success: false,

        message:
          "This candidate has already been matched to this placement request.",
      });
    }

    // ==================================================
    // CREATE
    // ==================================================

    const placementCandidateId = await generatePlacementCandidateId();

    const candidate = await PlacementCandidate.create({
      placementCandidateId,

      recruitId,

      providerId: recruit.company_id,

      seekerId: seeker.seeker_id,

      matchedByAdminId: req.admin.adminId,

      candidate_snapshot: buildCandidateSnapshot(seeker),

      status: "MATCHED",

      matchedAt: new Date(),
    });

    return res.status(201).json({
      success: true,

      message: "Candidate matched successfully.",

      data: serializeCandidate(candidate),
    });
  } catch (error) {
    console.error("MATCH CANDIDATE ERROR:", error);

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,

        message: "This candidate has already been matched.",
      });
    }

    return res.status(500).json({
      success: false,

      message: "Failed to match candidate.",
    });
  }
};
