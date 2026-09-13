const mongoose = require("mongoose");
const Profile = require("../../models/providers/profileSchema");
const Register = require("../../models/providers/registerSchema");

// Fields that belong to Register
const REGISTER_UPDATE_FIELDS = [
  "name",
  "companyName",
  "email",
];

// Fields that belong to Profile
const PROFILE_UPDATE_FIELDS = [
  "phone",
  "address",
  "website",
  "industry",
  "contact_person",
  "contact_person_phone",
  "contact_person_email",
  "hiring_needs",
  "notes",
  "status",
];

// Clean empty strings
const cleanValue = (value) => {
  if (typeof value !== "string") return value;

  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
};

// GET PROFILE
exports.getProfile = async (req, res) => {
  try {
    const { registerId } = req.params;

    if (!registerId) {
      return res.status(400).json({
        status: "error",
        message: "registerId is required",
      });
    }

    // Find the specific registered user
    const register = await Register.findOne({ registerId }).select(
      "-password"
    );

    if (!register) {
      return res.status(404).json({
        status: "error",
        message: "Register user not found",
      });
    }

    // Find profile belonging to the same registerId
    let profile = await Profile.findOne({ registerId });

    // Create profile if it doesn't exist
    if (!profile) {
      profile = await Profile.create({
        registerId,
        name: register.name,
        company_name: register.companyName,
        email: register.email,
      });
    }

    res.json({
      status: "success",
      message: "Profile fetched successfully",

      register: {
        registerId: register.registerId,
        name: register.name,
        companyName: register.companyName,
        email: register.email,
        role: register.role,
      },

      profile,
    });
  } catch (err) {
    console.error("GET PROFILE ERROR:", err);

    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

// UPDATE PROFILE
exports.updateProfile = async (req, res) => {
  try {
    const { registerId } = req.params;

    if (!registerId) {
      return res.status(400).json({
        status: "error",
        message: "registerId is required",
      });
    }

    // --------------------------------------------------
    // 1. Find the EXACT register account
    // --------------------------------------------------

    const register = await Register.findOne({ registerId });

    if (!register) {
      return res.status(404).json({
        status: "error",
        message: "Register user not found",
      });
    }

    // --------------------------------------------------
    // 2. Separate Register fields and Profile fields
    // --------------------------------------------------

    const registerUpdates = {};
    const profileUpdates = {};

    REGISTER_UPDATE_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) {
        registerUpdates[field] = cleanValue(req.body[field]);
      }
    });

    PROFILE_UPDATE_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) {
        profileUpdates[field] = cleanValue(req.body[field]);
      }
    });

    // --------------------------------------------------
    // 3. Update Register document
    // --------------------------------------------------

    let updatedRegister = register;

    if (Object.keys(registerUpdates).length > 0) {
      updatedRegister = await Register.findOneAndUpdate(
        { registerId }, // IMPORTANT: specific ID only
        { $set: registerUpdates },
        {
          new: true,
          runValidators: true,
        }
      ).select("-password");
    }

    // --------------------------------------------------
    // 4. Find/create Profile for SAME registerId
    // --------------------------------------------------

    let profile = await Profile.findOne({ registerId });

    if (!profile) {
      profile = new Profile({
        registerId,
        name: updatedRegister.name,
        company_name: updatedRegister.companyName,
        email: updatedRegister.email,
      });
    }

    // --------------------------------------------------
    // 5. Keep account fields synchronized
    // --------------------------------------------------

    profile.name = updatedRegister.name;
    profile.company_name = updatedRegister.companyName;
    profile.email = updatedRegister.email;

    // --------------------------------------------------
    // 6. Update Profile-specific fields
    // --------------------------------------------------

    Object.keys(profileUpdates).forEach((field) => {
      profile[field] = profileUpdates[field];
    });

    await profile.save();

    // --------------------------------------------------
    // 7. Return updated data
    // --------------------------------------------------

    res.json({
      status: "success",
      message: "Profile updated successfully",

      register: {
        registerId: updatedRegister.registerId,
        name: updatedRegister.name,
        companyName: updatedRegister.companyName,
        email: updatedRegister.email,
        role: updatedRegister.role,
      },

      profile,
    });
  } catch (err) {
    console.error("UPDATE PROFILE ERROR:", err);

    if (err.name === "ValidationError") {
      const firstError = Object.values(err.errors)[0];

      return res.status(400).json({
        status: "error",
        message: firstError.message,
      });
    }

    if (err.code === 11000) {
      return res.status(400).json({
        status: "error",
        message: "Email already exists",
      });
    }

    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};
