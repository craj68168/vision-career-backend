const Register = require("../../models/providers/registerSchema");

const Profile = require("../../models/providers/profileSchema");

const Vacancy = require("../../models/providers/vacancySchema");

const Application = require("../../models/applications/applicationSchema");

// ======================================================
// STAFF REVIEW
// ======================================================

const serializeStaffReview = (profile) => ({
  status: profile?.staff_review_status || "NOT_REVIEWED",

  note: profile?.staff_review_note || null,

  reviewedByStaffId: profile?.reviewed_by_staff_id || null,

  reviewedAt: profile?.staff_reviewed_at || null,
});

// ======================================================
// PROVIDER SERIALIZER
// ======================================================

const serializeProvider = ({
  register,
  profile,
  vacancyCount = 0,
  applicationCount = 0,
}) => {
  return {
    registerId: register.registerId,

    name: register.name,

    companyName: register.companyName,

    email: register.email,

    role: register.role,

    status: profile?.status || "active",

    phone: profile?.phone || null,

    address: profile?.address || null,

    website: profile?.website || null,

    industry: profile?.industry || null,

    contactPerson: profile?.contact_person || null,

    contactPersonPhone: profile?.contact_person_phone || null,

    contactPersonEmail: profile?.contact_person_email || null,

    hiringNeeds: profile?.hiring_needs || null,

    notes: profile?.notes || null,

    vacancyCount,

    applicationCount,

    staffReview: serializeStaffReview(profile),

    createdAt: register.createdAt,

    updatedAt: register.updatedAt,
  };
};

// ======================================================
// RELATED COUNTS
// ======================================================

const getCountMaps = async (registerIds) => {
  if (registerIds.length === 0) {
    return {
      vacancyMap: new Map(),

      applicationMap: new Map(),
    };
  }

  const [vacancies, applications] = await Promise.all([
    Vacancy.aggregate([
      {
        $match: {
          registerId: {
            $in: registerIds,
          },
        },
      },

      {
        $group: {
          _id: "$registerId",

          count: {
            $sum: 1,
          },
        },
      },
    ]),

    Application.aggregate([
      {
        $match: {
          provider_id: {
            $in: registerIds,
          },
        },
      },

      {
        $group: {
          _id: "$provider_id",

          count: {
            $sum: 1,
          },
        },
      },
    ]),
  ]);

  return {
    vacancyMap: new Map(vacancies.map((item) => [item._id, item.count])),

    applicationMap: new Map(applications.map((item) => [item._id, item.count])),
  };
};

// ======================================================
// GET STAFF PROVIDERS
//
// GET /api/staff/providers
// ======================================================

exports.getStaffProviders = async (req, res) => {
  try {
    const registers = await Register.find({
      role: "provider",
    })
      .sort({
        createdAt: -1,
      })
      .lean();

    const registerIds = registers.map((register) => register.registerId);

    const profiles = await Profile.find({
      registerId: {
        $in: registerIds,
      },
    }).lean();

    const profileMap = new Map(
      profiles.map((profile) => [profile.registerId, profile]),
    );

    const { vacancyMap, applicationMap } = await getCountMaps(registerIds);

    const data = registers.map((register) =>
      serializeProvider({
        register,

        profile: profileMap.get(register.registerId),

        vacancyCount: vacancyMap.get(register.registerId) || 0,

        applicationCount: applicationMap.get(register.registerId) || 0,
      }),
    );

    const summary = {
      total: data.length,

      active: data.filter((provider) => provider.status === "active").length,

      inactive: data.filter((provider) => provider.status === "inactive")
        .length,

      suspended: data.filter((provider) => provider.status === "suspended")
        .length,

      notReviewed: data.filter(
        (provider) => provider.staffReview.status === "NOT_REVIEWED",
      ).length,

      reviewed: data.filter(
        (provider) => provider.staffReview.status === "REVIEWED",
      ).length,

      needsAttention: data.filter(
        (provider) => provider.staffReview.status === "NEEDS_ATTENTION",
      ).length,

      totalVacancies: data.reduce(
        (total, provider) => total + provider.vacancyCount,
        0,
      ),

      totalApplications: data.reduce(
        (total, provider) => total + provider.applicationCount,
        0,
      ),
    };

    return res.status(200).json({
      success: true,

      count: data.length,

      summary,

      data,
    });
  } catch (error) {
    console.error("GET STAFF PROVIDERS ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load client companies.",
    });
  }
};

// ======================================================
// GET ONE PROVIDER
//
// GET /api/staff/providers/:registerId
// ======================================================

exports.getStaffProviderById = async (req, res) => {
  try {
    const { registerId } = req.params;

    const register = await Register.findOne({
      registerId,
      role: "provider",
    }).lean();

    if (!register) {
      return res.status(404).json({
        success: false,

        message: "Provider not found.",
      });
    }

    const [profile, vacancyCount, applicationCount] = await Promise.all([
      Profile.findOne({
        registerId,
      }).lean(),

      Vacancy.countDocuments({
        registerId,
      }),

      Application.countDocuments({
        provider_id: registerId,
      }),
    ]);

    return res.status(200).json({
      success: true,

      data: serializeProvider({
        register,
        profile,
        vacancyCount,
        applicationCount,
      }),
    });
  } catch (error) {
    console.error("GET STAFF PROVIDER ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load client company.",
    });
  }
};

// ======================================================
// REVIEW PROVIDER
//
// PATCH
// /api/staff/providers/:registerId/review
//
// Staff does NOT:
// - activate
// - deactivate
// - suspend
// - delete
// - change password
// - change account identity
// ======================================================

exports.reviewStaffProvider = async (req, res) => {
  try {
    const { registerId } = req.params;

    const { reviewStatus, note } = req.body;

    if (!["REVIEWED", "NEEDS_ATTENTION"].includes(reviewStatus)) {
      return res.status(400).json({
        success: false,

        message: "Invalid review status.",
      });
    }

    const normalizedNote = typeof note === "string" ? note.trim() : "";

    if (reviewStatus === "NEEDS_ATTENTION" && !normalizedNote) {
      return res.status(400).json({
        success: false,

        message:
          "A note is required when marking a client as needing attention.",
      });
    }

    if (normalizedNote.length > 2000) {
      return res.status(400).json({
        success: false,

        message: "Review note cannot exceed 2000 characters.",
      });
    }

    const register = await Register.findOne({
      registerId,
      role: "provider",
    }).lean();

    if (!register) {
      return res.status(404).json({
        success: false,

        message: "Provider not found.",
      });
    }

    const profile = await Profile.findOneAndUpdate(
      {
        registerId,
      },

      {
        $set: {
          name: register.name,

          company_name: register.companyName,

          email: register.email,

          staff_review_status: reviewStatus,

          staff_review_note: normalizedNote || null,

          reviewed_by_staff_id: req.staff.staffId,

          staff_reviewed_at: new Date(),
        },

        $setOnInsert: {
          registerId,
        },
      },

      {
        upsert: true,

        returnDocument: "after",

        runValidators: true,

        setDefaultsOnInsert: true,
      },
    );

    const [vacancyCount, applicationCount] = await Promise.all([
      Vacancy.countDocuments({
        registerId,
      }),

      Application.countDocuments({
        provider_id: registerId,
      }),
    ]);

    return res.status(200).json({
      success: true,

      message:
        reviewStatus === "REVIEWED"
          ? "Client review completed."
          : "Client marked as needing Admin attention.",

      data: serializeProvider({
        register,

        profile: profile.toObject(),

        vacancyCount,

        applicationCount,
      }),
    });
  } catch (error) {
    console.error("STAFF PROVIDER REVIEW ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to save client review.",
    });
  }
};
