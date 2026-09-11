const Seeker = require("../../models/seekers/seekerSchema");

// ======================================================
// GET LOGGED-IN SEEKER PROFILE
// ======================================================

exports.getProfile = async (req, res) => {
  try {
    const seekerId = req.user.id;

    const seeker = await Seeker.findById(seekerId);

    if (!seeker) {
      return res.status(404).json({
        status: "error",
        message: "Seeker not found",
      });
    }

    return res.status(200).json({
      status: "success",
      profile: seeker,
    });
  } catch (error) {
    console.error("Get seeker profile error:", error);

    return res.status(500).json({
      status: "error",
      message: "Failed to get seeker profile",
    });
  }
};

// ======================================================
// UPDATE LOGGED-IN SEEKER PROFILE
// ======================================================

exports.updateProfile = async (req, res) => {
  try {
    const seekerId = req.user.id;

    const allowedFields = [
      "phone",
      "address",
      "current_location",
      "date_of_birth",
      "gender",
      "nationality",
      "visa_type",
      "visa_expiry_date",
      "japanese_level",
      "skills",
      "desired_job",
      "desired_location",
      "available_from",
      "resume_file",
      "generated_resume_file",
      "other_documents",
      "education",
      "employment_history",
      "notes",
    ];

    const updateData = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        status: "error",
        message: "No valid profile fields provided",
      });
    }

    const seeker = await Seeker.findByIdAndUpdate(
      seekerId,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!seeker) {
      return res.status(404).json({
        status: "error",
        message: "Seeker not found",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Profile updated successfully",
      profile: seeker,
    });
  } catch (error) {
    console.error("Update seeker profile error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        status: "error",
        message: error.message,
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        message: "Invalid seeker ID",
      });
    }

    return res.status(500).json({
      status: "error",
      message: "Failed to update seeker profile",
    });
  }
};