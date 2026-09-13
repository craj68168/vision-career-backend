const Seeker = require("../../models/seekers/seekerSchema");
const path = require("path");
const fs = require("fs");
// ======================================================
// REQUIRED PROFILE FIELDS
// ======================================================

const REQUIRED_PROFILE_FIELDS = [
  {
    field: "phone",
    label: "Phone Number",
  },
  {
    field: "address",
    label: "Address",
  },
  {
    field: "nationality",
    label: "Nationality",
  },
  {
    field: "visa_type",
    label: "Visa Type",
  },
  {
    field: "japanese_level",
    label: "Japanese Level",
  },
  {
    field: "desired_job",
    label: "Desired Job",
  },
  {
    field: "desired_location",
    label: "Desired Location",
  },
  {
    field: "available_from",
    label: "Available From",
  },
  {
    field: "resume_file",
    label: "Resume File",
  },
  {
    field: "education",
    label: "Educational Background",
  },
];

// ======================================================
// CALCULATE PROFILE COMPLETION
// ======================================================

const calculateProfileCompletion = (seeker) => {
  const missingFields = [];

  REQUIRED_PROFILE_FIELDS.forEach(({ field, label }) => {
    if (field === "education") {
      if (!Array.isArray(seeker.education) || seeker.education.length === 0) {
        missingFields.push({
          field,
          label,
        });
      }

      return;
    }

    const value = seeker[field];

    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      missingFields.push({
        field,
        label,
      });
    }
  });

  const totalFields = REQUIRED_PROFILE_FIELDS.length;

  const completedFields =
    totalFields - missingFields.length;

  const completionPercentage = Math.round(
    (completedFields / totalFields) * 100,
  );

  return {
    isComplete: missingFields.length === 0,
    completionPercentage,
    missingFields,
  };
};

// ======================================================
// FORMAT PROFILE RESPONSE
// ======================================================

const formatProfileResponse = (seeker) => {
  const {
    isComplete,
    completionPercentage,
    missingFields,
  } = calculateProfileCompletion(seeker);

  const seekerObject = seeker.toObject();

  const education = seekerObject.education || [];

  const employmentHistory =
    seekerObject.employment_history || [];

  delete seekerObject.education;
  delete seekerObject.employment_history;

  // MongoDB internal fields do not need to be exposed
  delete seekerObject._id;
  delete seekerObject.__v;

  return {
    is_complete: isComplete,
    completion_percentage: completionPercentage,
    missing_fields: missingFields,

    profile: seekerObject,

    education,

    employment_history: employmentHistory,
  };
};

// ======================================================
// GET LOGGED-IN SEEKER PROFILE
// GET /api/seekers/profile
// ======================================================

exports.getProfile = async (req, res) => {
  try {
    const seekerId = req.user.seeker_id;

    const seeker = await Seeker.findOne({
      seeker_id: seekerId,
    });

    if (!seeker) {
      return res.status(404).json({
        status: "error",
        message: "Seeker not found",
      });
    }

    const profileData =
      formatProfileResponse(seeker);

    return res.status(200).json({
      status: "success",

      ...profileData,
    });
  } catch (error) {
    console.error(
      "Get seeker profile error:",
      error,
    );

    return res.status(500).json({
      status: "error",
      message: "Failed to get seeker profile",
    });
  }
};

// ======================================================
// UPDATE LOGGED-IN SEEKER PROFILE
// PATCH /api/seekers/profile
// ======================================================

exports.updateProfile = async (req, res) => {
  try {
    const seekerId = req.user.seeker_id;

    // Only fields the seeker is allowed to edit
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
        message:
          "No valid profile fields provided",
      });
    }

    const seeker =
      await Seeker.findOneAndUpdate(
        {
          seeker_id: seekerId,
        },
        updateData,
        {
          new: true,
          runValidators: true,
        },
      );

    if (!seeker) {
      return res.status(404).json({
        status: "error",
        message: "Seeker not found",
      });
    }

    const profileData =
      formatProfileResponse(seeker);

    return res.status(200).json({
      status: "success",

      message:
        "Profile updated successfully",

      ...profileData,
    });
  } catch (error) {
    console.error(
      "Update seeker profile error:",
      error,
    );

    if (error.name === "ValidationError") {
      return res.status(400).json({
        status: "error",
        message: error.message,
      });
    }

    return res.status(500).json({
      status: "error",
      message:
        "Failed to update seeker profile",
    });
  }
};

// ======================================================
// UPLOAD / REPLACE SEEKER RESUME
// POST /api/seekers/profile/resume
// ======================================================

exports.uploadResume = async (req, res) => {
  let uploadedFilePath = null;

  try {
    const seekerId = req.user.seeker_id;

    // --------------------------------------------------
    // Check file
    // --------------------------------------------------

    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "Resume file is required",
      });
    }

    uploadedFilePath = req.file.path;

    // --------------------------------------------------
    // Resume file validation
    // --------------------------------------------------

    const allowedExtensions = [
      ".pdf",
      ".doc",
      ".docx",
    ];

    const allowedMimeTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    const extension = path
      .extname(req.file.originalname)
      .toLowerCase();

    const validExtension =
      allowedExtensions.includes(extension);

    const validMimeType =
      allowedMimeTypes.includes(
        req.file.mimetype,
      );

    if (!validExtension || !validMimeType) {
      fs.unlink(req.file.path, () => {});

      return res.status(400).json({
        status: "error",
        message:
          "Resume must be a PDF, DOC or DOCX file",
      });
    }

    // --------------------------------------------------
    // Find seeker
    // --------------------------------------------------

    const seeker = await Seeker.findOne({
      seeker_id: seekerId,
    });

    if (!seeker) {
      fs.unlink(req.file.path, () => {});

      return res.status(404).json({
        status: "error",
        message: "Seeker not found",
      });
    }

    // --------------------------------------------------
    // Store previous resume
    // --------------------------------------------------

    const previousResume =
      seeker.resume_file;

    // --------------------------------------------------
    // Save new resume path
    // --------------------------------------------------

    const resumeFile =
      `/uploads/${req.file.filename}`;

    seeker.resume_file = resumeFile;

    await seeker.save();

    // --------------------------------------------------
    // Delete previous resume
    // --------------------------------------------------

    if (previousResume) {
      const previousFileName =
        path.basename(previousResume);

      const previousFilePath =
        path.join(
          __dirname,
          "../../uploads",
          previousFileName,
        );

      fs.unlink(
        previousFilePath,
        (error) => {
          if (
            error &&
            error.code !== "ENOENT"
          ) {
            console.error(
              "Failed to delete old resume:",
              error,
            );
          }
        },
      );
    }

    // --------------------------------------------------
    // Profile completion
    // --------------------------------------------------

    const profileData =
      formatProfileResponse(seeker);

    return res.status(200).json({
      status: "success",
      message:
        "Resume uploaded successfully",

      ...profileData,
    });
  } catch (error) {
    console.error(
      "Upload seeker resume error:",
      error,
    );

    // If database saving failed,
    // remove the newly uploaded file.
    if (uploadedFilePath) {
      fs.unlink(
        uploadedFilePath,
        () => {},
      );
    }

    return res.status(500).json({
      status: "error",
      message:
        "Failed to upload resume",
    });
  }
};