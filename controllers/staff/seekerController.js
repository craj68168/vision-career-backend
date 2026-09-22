const fs = require("fs");
const path = require("path");

const Seeker = require("../../models/seekers/seekerSchema");

const Application = require("../../models/applications/applicationSchema");

// ======================================================
// CONSTANTS
// ======================================================

const APPROVAL_STATUSES = ["pending", "approved", "rejected"];

const ACCOUNT_STATUSES = ["inactive", "active", "suspended"];

const PLACEMENT_STATUSES = [
  "unplaced",
  "matching",
  "interview",
  "selected",
  "placed",
];

const SCREENING_STATUSES = ["NOT_SCREENED", "SCREENED", "NEEDS_ATTENTION"];

// ======================================================
// ESCAPE REGEX
// ======================================================

const escapeRegex = (value = "") => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// ======================================================
// STAFF SCREENING SERIALIZER
// ======================================================

const serializeScreening = (seeker) => ({
  status: seeker.staff_screening_status || "NOT_SCREENED",

  note: seeker.staff_screening_note || null,

  screenedByStaffId: seeker.screened_by_staff_id || null,

  screenedAt: seeker.screened_at || null,
});

// ======================================================
// SEEKER SERIALIZER
// ======================================================

const serializeSeeker = (seeker, applicationsCount = 0) => {
  const item =
    typeof seeker.toObject === "function" ? seeker.toObject() : seeker;

  return {
    _id: item._id,

    seeker_id: item.seeker_id,

    name: item.name,

    email: item.email,

    approval_status: item.approval_status,

    account_status: item.account_status,

    approval_reviewed_at: item.approval_reviewed_at || null,

    rejection_reason: item.rejection_reason || null,

    profile_photo: item.profile_photo || null,

    phone: item.phone || null,

    address: item.address || null,

    current_location: item.current_location || null,

    date_of_birth: item.date_of_birth || null,

    gender: item.gender || null,

    nationality: item.nationality || null,

    visa_type: item.visa_type || null,

    visa_expiry_date: item.visa_expiry_date || null,

    japanese_level: item.japanese_level || null,

    skills: item.skills || [],

    desired_job: item.desired_job || null,

    desired_location: item.desired_location || null,

    available_from: item.available_from || null,

    resume_file: item.resume_file || null,

    generated_resume_file: item.generated_resume_file || null,

    other_documents: item.other_documents || [],

    education: item.education || [],

    employment_history: item.employment_history || [],

    placement_status: item.placement_status,

    applications_count: applicationsCount,

    staffScreening: serializeScreening(item),

    created_at: item.created_at,

    updated_at: item.updated_at,
  };
};

// ======================================================
// APPLICATION COUNTS
// ======================================================

const getApplicationCountMap = async (seekerIds) => {
  if (seekerIds.length === 0) {
    return {};
  }

  const counts = await Application.aggregate([
    {
      $match: {
        seeker_id: {
          $in: seekerIds,
        },
      },
    },

    {
      $group: {
        _id: "$seeker_id",

        count: {
          $sum: 1,
        },
      },
    },
  ]);

  return counts.reduce((accumulator, item) => {
    accumulator[item._id] = item.count;

    return accumulator;
  }, {});
};

// ======================================================
// GET STAFF SEEKERS
//
// GET /api/staff/seekers
// ======================================================

exports.getStaffSeekers = async (req, res) => {
  try {
    const {
      search = "",
      approvalStatus = "",
      accountStatus = "",
      placementStatus = "",
      screeningStatus = "",
      page = "1",
      limit = "20",
    } = req.query;

    const currentPage = Math.max(Number.parseInt(page, 10) || 1, 1);

    const pageLimit = Math.min(
      Math.max(Number.parseInt(limit, 10) || 20, 1),
      100,
    );

    const filter = {};

    // ==================================================
    // SEARCH
    // ==================================================

    if (typeof search === "string" && search.trim()) {
      const regex = new RegExp(escapeRegex(search.trim()), "i");

      filter.$or = [
        {
          seeker_id: regex,
        },

        {
          name: regex,
        },

        {
          email: regex,
        },

        {
          phone: regex,
        },

        {
          current_location: regex,
        },

        {
          desired_job: regex,
        },
      ];
    }

    // ==================================================
    // FILTERS
    // ==================================================

    if (APPROVAL_STATUSES.includes(approvalStatus)) {
      filter.approval_status = approvalStatus;
    }

    if (ACCOUNT_STATUSES.includes(accountStatus)) {
      filter.account_status = accountStatus;
    }

    if (PLACEMENT_STATUSES.includes(placementStatus)) {
      filter.placement_status = placementStatus;
    }

    if (SCREENING_STATUSES.includes(screeningStatus)) {
      if (screeningStatus === "NOT_SCREENED") {
        filter.$and = [
          ...(filter.$and || []),

          {
            $or: [
              {
                staff_screening_status: "NOT_SCREENED",
              },

              {
                staff_screening_status: {
                  $exists: false,
                },
              },

              {
                staff_screening_status: null,
              },
            ],
          },
        ];
      } else {
        filter.staff_screening_status = screeningStatus;
      }
    }

    // ==================================================
    // QUERY
    // ==================================================

    const [
      seekers,
      filteredCount,

      total,
      pendingApproval,

      notScreened,
      screened,
      needsAttention,
    ] = await Promise.all([
      Seeker.find(filter)
        .sort({
          created_at: -1,
        })
        .skip((currentPage - 1) * pageLimit)
        .limit(pageLimit)
        .lean(),

      Seeker.countDocuments(filter),

      Seeker.countDocuments(),

      Seeker.countDocuments({
        approval_status: "pending",
      }),

      Seeker.countDocuments({
        approval_status: "pending",

        $or: [
          {
            staff_screening_status: "NOT_SCREENED",
          },

          {
            staff_screening_status: {
              $exists: false,
            },
          },

          {
            staff_screening_status: null,
          },
        ],
      }),

      Seeker.countDocuments({
        approval_status: "pending",

        staff_screening_status: "SCREENED",
      }),

      Seeker.countDocuments({
        approval_status: "pending",

        staff_screening_status: "NEEDS_ATTENTION",
      }),
    ]);

    const seekerIds = seekers.map((seeker) => seeker.seeker_id);

    const applicationCountMap = await getApplicationCountMap(seekerIds);

    const data = seekers.map((seeker) =>
      serializeSeeker(
        seeker,

        applicationCountMap[seeker.seeker_id] || 0,
      ),
    );

    const pages = Math.max(Math.ceil(filteredCount / pageLimit), 1);

    return res.status(200).json({
      success: true,

      summary: {
        total,

        pendingApproval,

        notScreened,

        screened,

        needsAttention,
      },

      pagination: {
        page: currentPage,

        limit: pageLimit,

        total: filteredCount,

        pages,
      },

      data,
    });
  } catch (error) {
    console.error("GET STAFF SEEKERS ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load job seekers.",
    });
  }
};

// ======================================================
// GET ONE SEEKER
//
// GET /api/staff/seekers/:seekerId
// ======================================================

exports.getStaffSeekerById = async (req, res) => {
  try {
    const { seekerId } = req.params;

    const seeker = await Seeker.findOne({
      seeker_id: seekerId,
    }).lean();

    if (!seeker) {
      return res.status(404).json({
        success: false,

        message: "Job seeker not found.",
      });
    }

    const applicationsCount = await Application.countDocuments({
      seeker_id: seekerId,
    });

    return res.status(200).json({
      success: true,

      data: serializeSeeker(seeker, applicationsCount),
    });
  } catch (error) {
    console.error("GET STAFF SEEKER ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load job seeker.",
    });
  }
};

// ======================================================
// SCREEN SEEKER REGISTRATION
//
// PATCH /api/staff/seekers/:seekerId/screen
//
// Staff does NOT approve or reject.
// ======================================================

exports.screenStaffSeeker = async (req, res) => {
  try {
    const { seekerId } = req.params;

    const { screeningStatus, note } = req.body;

    if (!["SCREENED", "NEEDS_ATTENTION"].includes(screeningStatus)) {
      return res.status(400).json({
        success: false,

        message: "Invalid screening status.",
      });
    }

    const normalizedNote = typeof note === "string" ? note.trim() : "";

    if (screeningStatus === "NEEDS_ATTENTION" && !normalizedNote) {
      return res.status(400).json({
        success: false,

        message:
          "A screening note is required when marking a Job Seeker as needing attention.",
      });
    }

    if (normalizedNote.length > 2000) {
      return res.status(400).json({
        success: false,

        message: "Screening note cannot exceed 2000 characters.",
      });
    }

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
    // ONLY PENDING REGISTRATIONS CAN BE SCREENED
    // ==================================================

    if (seeker.approval_status !== "pending") {
      return res.status(409).json({
        success: false,

        message: "Only Job Seekers waiting for Admin approval can be screened.",
      });
    }

    seeker.staff_screening_status = screeningStatus;

    seeker.staff_screening_note = normalizedNote || null;

    seeker.screened_by_staff_id = req.staff.staffId;

    seeker.screened_at = new Date();

    await seeker.save();

    const applicationsCount = await Application.countDocuments({
      seeker_id: seekerId,
    });

    return res.status(200).json({
      success: true,

      message:
        screeningStatus === "SCREENED"
          ? "Job Seeker screening completed."
          : "Job Seeker marked as needing Admin attention.",

      data: serializeSeeker(seeker, applicationsCount),
    });
  } catch (error) {
    console.error("SCREEN STAFF SEEKER ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to screen Job Seeker.",
    });
  }
};

// ======================================================
// RESUME
//
// GET /api/staff/seekers/:seekerId/resume
// ======================================================

exports.getStaffSeekerResume = async (req, res) => {
  try {
    const { seekerId } = req.params;

    const seeker = await Seeker.findOne({
      seeker_id: seekerId,
    }).select("seeker_id name resume_file generated_resume_file");

    if (!seeker) {
      return res.status(404).json({
        success: false,

        message: "Job seeker not found.",
      });
    }

    const resumeUrl = seeker.resume_file || seeker.generated_resume_file;

    if (!resumeUrl) {
      return res.status(404).json({
        success: false,

        message: "This Job Seeker has no resume.",
      });
    }

    const fileName = path.basename(resumeUrl);

    const candidates = [
      path.join(process.cwd(), "uploads", fileName),

      path.join(process.cwd(), "private_uploads", fileName),
    ];

    const filePath = candidates.find((candidate) => fs.existsSync(candidate));

    if (!filePath) {
      return res.status(404).json({
        success: false,

        message: "Resume file not found.",
      });
    }

    return res.download(filePath, `${seeker.seeker_id}-${fileName}`);
  } catch (error) {
    console.error("STAFF SEEKER RESUME ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to download resume.",
    });
  }
};
