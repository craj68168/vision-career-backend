const Register = require("../../models/providers/registerSchema");

const Profile = require("../../models/providers/profileSchema");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ======================================================
// REGISTER
// ======================================================

exports.register = async (req, res) => {
  let createdUser = null;

  try {
    const { name, companyName, email, password } = req.body;

    if (!name || !companyName || !email || !password) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await Register.findOne({
      email: normalizedEmail,
    });

    if (existing) {
      return res.status(409).json({
        message: "Email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    createdUser = await Register.create({
      name: name.trim(),

      companyName: companyName.trim(),

      email: normalizedEmail,

      password: hashedPassword,

      role: "provider",
    });

    // --------------------------------------------------
    // CREATE PROFILE AUTOMATICALLY
    // --------------------------------------------------

    await Profile.findOneAndUpdate(
      {
        registerId: createdUser.registerId,
      },

      {
        $set: {
          name: createdUser.name,

          company_name: createdUser.companyName,

          email: createdUser.email,

          status: "active",
        },

        $setOnInsert: {
          registerId: createdUser.registerId,
        },
      },

      {
        upsert: true,

        returnDocument: "after",

        runValidators: true,

        setDefaultsOnInsert: true,
      },
    );

    return res.status(201).json({
      message: "Register successful",

      user: {
        id: createdUser._id,

        registerId: createdUser.registerId,

        name: createdUser.name,

        companyName: createdUser.companyName,

        email: createdUser.email,

        role: createdUser.role,
      },
    });
  } catch (error) {
    console.error("PROVIDER REGISTER ERROR:", error);

    if (createdUser) {
      await Register.deleteOne({
        _id: createdUser._id,
      }).catch(() => null);
    }

    return res.status(500).json({
      message: error.message,
    });
  }
};

// ======================================================
// LOGIN
// ======================================================

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await Register.findOne({
      email: normalizedEmail,

      role: "provider",
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const profile = await Profile.findOne({
      registerId: user.registerId,
    });

    // --------------------------------------------------
    // ACCOUNT STATUS
    // --------------------------------------------------

    if (profile?.status === "inactive") {
      return res.status(403).json({
        message:
          "Your provider account is inactive. Please contact the administrator.",
      });
    }

    if (profile?.status === "suspended") {
      return res.status(403).json({
        message:
          "Your provider account has been suspended. Please contact the administrator.",
      });
    }

    const token = jwt.sign(
      {
        id: user._id,

        role: user.role,

        registerId: user.registerId,
      },

      process.env.JWT_SECRET,

      {
        expiresIn: "1h",
      },
    );

    return res.status(200).json({
      message: "Login successful",

      token,

      user: {
        id: user._id,

        registerId: user.registerId,

        name: user.name,

        companyName: user.companyName,

        email: user.email,

        role: user.role,

        status: profile?.status || "active",
      },
    });
  } catch (error) {
    console.error("PROVIDER LOGIN ERROR:", error);

    return res.status(500).json({
      message: error.message,
    });
  }
};
