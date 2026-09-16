const bcrypt = require("bcryptjs");

const Register = require("../../models/providers/registerSchema");
const Profile = require("../../models/providers/profileSchema");
const Vacancy = require("../../models/providers/vacancySchema");
const Application = require("../../models/applications/applicationSchema");

const ALLOWED_STATUSES = ["active", "inactive", "suspended"];

// ======================================================
// HELPERS
// ======================================================

const buildProfileResponse = ({
  register,
  profile,
  vacancyCount = 0,
  applicationCount = 0,
}) => ({
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

  createdAt: register.createdAt,
  updatedAt: register.updatedAt,
});

// ======================================================
// GET PROVIDERS
//
// GET /api/admin/providers
// ======================================================

exports.getProviders = async (req, res) => {
  try {
    const registers = await Register.find({
      role: "provider",
    })
      .sort({
        createdAt: -1,
      })
      .lean();

    const registerIds = registers.map((provider) => provider.registerId);

    const [profiles, vacancyCounts, applicationCounts] = await Promise.all([
      Profile.find({
        registerId: {
          $in: registerIds,
        },
      }).lean(),

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

    const profileMap = new Map(
      profiles.map((profile) => [profile.registerId, profile]),
    );

    const vacancyCountMap = new Map(
      vacancyCounts.map((item) => [item._id, item.count]),
    );

    const applicationCountMap = new Map(
      applicationCounts.map((item) => [item._id, item.count]),
    );

    const data = registers.map((register) =>
      buildProfileResponse({
        register,
        profile: profileMap.get(register.registerId),
        vacancyCount: vacancyCountMap.get(register.registerId) || 0,
        applicationCount: applicationCountMap.get(register.registerId) || 0,
      }),
    );

    const summary = {
      total: data.length,

      active: data.filter((provider) => provider.status === "active").length,

      inactive: data.filter((provider) => provider.status === "inactive")
        .length,

      suspended: data.filter((provider) => provider.status === "suspended")
        .length,

      withVacancies: data.filter((provider) => provider.vacancyCount > 0)
        .length,

      withoutVacancies: data.filter((provider) => provider.vacancyCount === 0)
        .length,

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
    console.error("GET ADMIN PROVIDERS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load providers.",
    });
  }
};

// ======================================================
// GET ONE PROVIDER
//
// GET /api/admin/providers/:registerId
// ======================================================

exports.getProviderById = async (req, res) => {
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
      data: buildProfileResponse({
        register,
        profile,
        vacancyCount,
        applicationCount,
      }),
    });
  } catch (error) {
    console.error("GET ADMIN PROVIDER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load provider.",
    });
  }
};

// ======================================================
// CREATE PROVIDER
//
// POST /api/admin/providers
// ======================================================

exports.createProvider = async (req, res) => {
  let createdRegister = null;

  try {
    const {
      name,
      companyName,
      email,
      password,

      phone,
      address,
      website,
      industry,

      contactPerson,
      contactPersonPhone,
      contactPersonEmail,

      hiringNeeds,
      notes,

      status = "active",
    } = req.body;

    if (!name || !companyName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, company name, email and password are required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters.",
      });
    }

    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid provider status.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await Register.findOne({
      email: normalizedEmail,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    createdRegister = await Register.create({
      name: name.trim(),

      companyName: companyName.trim(),

      email: normalizedEmail,

      password: hashedPassword,

      role: "provider",
    });

    const profile = await Profile.create({
      registerId: createdRegister.registerId,

      name: createdRegister.name,

      company_name: createdRegister.companyName,

      email: createdRegister.email,

      phone: phone || null,

      address: address || null,

      website: website || null,

      industry: industry || null,

      contact_person: contactPerson || null,

      contact_person_phone: contactPersonPhone || null,

      contact_person_email: contactPersonEmail || null,

      hiring_needs: hiringNeeds || null,

      notes: notes || null,

      status,
    });

    return res.status(201).json({
      success: true,
      message: "Provider created successfully.",

      data: buildProfileResponse({
        register: createdRegister.toObject(),

        profile: profile.toObject(),

        vacancyCount: 0,

        applicationCount: 0,
      }),
    });
  } catch (error) {
    console.error("CREATE ADMIN PROVIDER ERROR:", error);

    if (createdRegister) {
      await Register.deleteOne({
        _id: createdRegister._id,
      }).catch(() => null);
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create provider.",
    });
  }
};

// ======================================================
// UPDATE PROVIDER
//
// PATCH /api/admin/providers/:registerId
// ======================================================

exports.updateProvider = async (req, res) => {
  try {
    const { registerId } = req.params;

    const register = await Register.findOne({
      registerId,
      role: "provider",
    }).select("+password");

    if (!register) {
      return res.status(404).json({
        success: false,
        message: "Provider not found.",
      });
    }

    const {
      name,
      companyName,
      email,
      password,

      phone,
      address,
      website,
      industry,

      contactPerson,
      contactPersonPhone,
      contactPersonEmail,

      hiringNeeds,
      notes,

      status,
    } = req.body;

    if (email !== undefined) {
      const normalizedEmail = email.trim().toLowerCase();

      const existing = await Register.findOne({
        email: normalizedEmail,

        registerId: {
          $ne: registerId,
        },
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          message: "Email already exists.",
        });
      }

      register.email = normalizedEmail;
    }

    if (name !== undefined) {
      register.name = name.trim();
    }

    if (companyName !== undefined) {
      register.companyName = companyName.trim();
    }

    if (password !== undefined && password !== "") {
      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 8 characters.",
        });
      }

      register.password = await bcrypt.hash(password, 10);
    }

    if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid provider status.",
      });
    }

    await register.save();

    const profileUpdate = {
      name: register.name,

      company_name: register.companyName,

      email: register.email,
    };

    if (phone !== undefined) {
      profileUpdate.phone = phone || null;
    }

    if (address !== undefined) {
      profileUpdate.address = address || null;
    }

    if (website !== undefined) {
      profileUpdate.website = website || null;
    }

    if (industry !== undefined) {
      profileUpdate.industry = industry || null;
    }

    if (contactPerson !== undefined) {
      profileUpdate.contact_person = contactPerson || null;
    }

    if (contactPersonPhone !== undefined) {
      profileUpdate.contact_person_phone = contactPersonPhone || null;
    }

    if (contactPersonEmail !== undefined) {
      profileUpdate.contact_person_email = contactPersonEmail || null;
    }

    if (hiringNeeds !== undefined) {
      profileUpdate.hiring_needs = hiringNeeds || null;
    }

    if (notes !== undefined) {
      profileUpdate.notes = notes || null;
    }

    if (status !== undefined) {
      profileUpdate.status = status;
    }

    const profile = await Profile.findOneAndUpdate(
      {
        registerId,
      },

      {
        $set: profileUpdate,

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

      message: "Provider updated successfully.",

      data: buildProfileResponse({
        register: register.toObject(),

        profile: profile.toObject(),

        vacancyCount,

        applicationCount,
      }),
    });
  } catch (error) {
    console.error("UPDATE ADMIN PROVIDER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update provider.",
    });
  }
};

// ======================================================
// UPDATE PROVIDER STATUS
//
// PATCH /api/admin/providers/:registerId/status
// ======================================================

exports.updateProviderStatus = async (req, res) => {
  try {
    const { registerId } = req.params;

    const { status } = req.body;

    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,

        message: "Invalid provider status.",
      });
    }

    const register = await Register.findOne({
      registerId,
      role: "provider",
    });

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
          status,

          name: register.name,

          company_name: register.companyName,

          email: register.email,
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

    return res.status(200).json({
      success: true,

      message: `Provider status changed to ${status}.`,

      data: {
        registerId,

        status: profile.status,
      },
    });
  } catch (error) {
    console.error("UPDATE PROVIDER STATUS ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to update provider status.",
    });
  }
};

// ======================================================
// DELETE PROVIDER
//
// DELETE /api/admin/providers/:registerId
// ======================================================

exports.deleteProvider = async (req, res) => {
  try {
    const { registerId } = req.params;

    const register = await Register.findOne({
      registerId,

      role: "provider",
    });

    if (!register) {
      return res.status(404).json({
        success: false,

        message: "Provider not found.",
      });
    }

    const [vacancyCount, applicationCount] = await Promise.all([
      Vacancy.countDocuments({
        registerId,
      }),

      Application.countDocuments({
        provider_id: registerId,
      }),
    ]);

    if (vacancyCount > 0 || applicationCount > 0) {
      return res.status(409).json({
        success: false,

        message:
          "This provider has recruitment history and cannot be deleted. Set the provider to inactive or suspended instead.",

        data: {
          vacancyCount,

          applicationCount,
        },
      });
    }

    await Promise.all([
      Profile.deleteOne({
        registerId,
      }),

      Register.deleteOne({
        registerId,
      }),
    ]);

    return res.status(200).json({
      success: true,

      message: "Provider deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE ADMIN PROVIDER ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to delete provider.",
    });
  }
};
