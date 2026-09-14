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

    if (value === undefined || value === null || value === "") {
      missingFields.push({
        field,
        label,
      });
    }
  });

  const totalFields = REQUIRED_PROFILE_FIELDS.length;

  const completedFields = totalFields - missingFields.length;

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
  const { isComplete, completionPercentage, missingFields } =
    calculateProfileCompletion(seeker);

  const seekerObject = seeker.toObject();

  const education = seekerObject.education || [];

  const employmentHistory = seekerObject.employment_history || [];

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
// DELETE FILE
// ======================================================

const deleteFile = (fileUrl) => {
  if (!fileUrl) return;

  const fileName = path.basename(fileUrl);

  const filePath = path.join(__dirname, "../../uploads", fileName);

  fs.unlink(filePath, (error) => {
    if (error && error.code !== "ENOENT") {
      console.error("Failed to delete file:", error);
    }
  });
};

// ======================================================
// CLEAN UP NEW UPLOADS IF UPDATE FAILS
// ======================================================

const cleanupUploadedFiles = (files) => {
  if (!files) return;

  Object.values(files)
    .flat()
    .forEach((file) => {
      if (file?.path) {
        fs.unlink(file.path, () => {});
      }
    });
};

// ======================================================
// PARSE MULTIPART JSON FIELDS
// ======================================================

const parseJsonField = (value, fieldName) => {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value) || typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    const error = new Error(`Invalid ${fieldName} format`);
    error.statusCode = 400;
    throw error;
  }
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

    const profileData = formatProfileResponse(seeker);

    return res.status(200).json({
      status: "success",

      ...profileData,
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
// UPDATE COMPLETE SEEKER PROFILE
// PATCH /api/seekers/profile
// ======================================================

exports.updateProfile = async (req, res) => {
  try {
    const seekerId = req.user.seeker_id;

    // --------------------------------------------------
    // Find seeker
    // --------------------------------------------------

    const seeker = await Seeker.findOne({
      seeker_id: seekerId,
    });

    if (!seeker) {
      cleanupUploadedFiles(req.files);

      return res.status(404).json({
        status: "error",
        message: "Seeker not found",
      });
    }

    // --------------------------------------------------
    // Normal editable fields
    // --------------------------------------------------

    const allowedFields = [
      "name",
      "phone",
      "address",
      "current_location",
      "date_of_birth",
      "gender",
      "nationality",
      "visa_type",
      "visa_expiry_date",
      "japanese_level",
      "desired_job",
      "desired_location",
      "available_from",
      "notes",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        seeker[field] = req.body[field];
      }
    });

    // --------------------------------------------------
    // Skills
    // --------------------------------------------------

    if (req.body.skills !== undefined) {
      const skills = parseJsonField(req.body.skills, "skills");

      if (!Array.isArray(skills)) {
        cleanupUploadedFiles(req.files);

        return res.status(400).json({
          status: "error",
          message: "Skills must be an array",
        });
      }

      seeker.skills = skills;
    }

    // --------------------------------------------------
    // Education
    // --------------------------------------------------

    if (req.body.education !== undefined) {
      const education = parseJsonField(req.body.education, "education");

      if (!Array.isArray(education)) {
        cleanupUploadedFiles(req.files);

        return res.status(400).json({
          status: "error",
          message: "Education must be an array",
        });
      }

      seeker.education = education;
    }

    // --------------------------------------------------
    // Employment history
    // --------------------------------------------------

    if (req.body.employment_history !== undefined) {
      const employmentHistory = parseJsonField(
        req.body.employment_history,
        "employment_history",
      );

      if (!Array.isArray(employmentHistory)) {
        cleanupUploadedFiles(req.files);

        return res.status(400).json({
          status: "error",
          message: "Employment history must be an array",
        });
      }

      seeker.employment_history = employmentHistory;
    }

    // ==================================================
    // PROFILE PHOTO
    // ==================================================

    const profilePhoto = req.files?.profile_photo?.[0];

    let previousProfilePhoto = null;

    if (profilePhoto) {
      const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];

      const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];

      const extension = path.extname(profilePhoto.originalname).toLowerCase();

      if (
        !allowedExtensions.includes(extension) ||
        !allowedMimeTypes.includes(profilePhoto.mimetype)
      ) {
        cleanupUploadedFiles(req.files);

        return res.status(400).json({
          status: "error",
          message: "Profile photo must be JPG, JPEG, PNG or WEBP",
        });
      }

      previousProfilePhoto = seeker.profile_photo;

      seeker.profile_photo = `/uploads/${profilePhoto.filename}`;
    }

    // ==================================================
    // RESUME
    // ==================================================

    const resume = req.files?.resume?.[0];

    let previousResume = null;

    if (resume) {
      const allowedExtensions = [".pdf", ".doc", ".docx"];

      const allowedMimeTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];

      const extension = path.extname(resume.originalname).toLowerCase();

      if (
        !allowedExtensions.includes(extension) ||
        !allowedMimeTypes.includes(resume.mimetype)
      ) {
        cleanupUploadedFiles(req.files);

        return res.status(400).json({
          status: "error",
          message: "Resume must be a PDF, DOC or DOCX file",
        });
      }

      previousResume = seeker.resume_file;

      seeker.resume_file = `/uploads/${resume.filename}`;
    }

    // ======================================================
    // OTHER DOCUMENTS
    // ======================================================

    const otherDocumentFiles = req.files?.other_documents || [];

    const documentsToDelete = [];

    if (!Array.isArray(seeker.other_documents)) {
      seeker.other_documents = [];
    }
    // ------------------------------------------------------
    // ADD NEW DOCUMENTS
    // ------------------------------------------------------

    if (otherDocumentFiles.length > 0) {
      let documentMeta = [];

      if (req.body.other_documents_meta) {
        documentMeta = parseJsonField(
          req.body.other_documents_meta,
          "other_documents_meta",
        );

        if (!Array.isArray(documentMeta)) {
          cleanupUploadedFiles(req.files);

          return res.status(400).json({
            status: "error",
            message: "other_documents_meta must be an array",
          });
        }
      }

      // If metadata is supplied,
      // it must match the number of uploaded files
      if (
        documentMeta.length > 0 &&
        documentMeta.length !== otherDocumentFiles.length
      ) {
        cleanupUploadedFiles(req.files);

        return res.status(400).json({
          status: "error",
          message: "Document metadata count must match uploaded document count",
        });
      }

      otherDocumentFiles.forEach((file, index) => {
        const meta = documentMeta[index] || {};

        seeker.other_documents.push({
          name: meta.name || file.originalname,

          document_type: meta.document_type || "other",

          file_url: `/uploads/${file.filename}`,
        });
      });
    }

    // ------------------------------------------------------
    // REMOVE EXISTING DOCUMENTS
    // ------------------------------------------------------

    if (req.body.remove_document_ids !== undefined) {
      const removeDocumentIds = parseJsonField(
        req.body.remove_document_ids,
        "remove_document_ids",
      );

      if (!Array.isArray(removeDocumentIds)) {
        cleanupUploadedFiles(req.files);

        return res.status(400).json({
          status: "error",
          message: "remove_document_ids must be an array",
        });
      }

      seeker.other_documents.forEach((document) => {
        if (removeDocumentIds.includes(document._id.toString())) {
          documentsToDelete.push(document.file_url);
        }
      });

      seeker.other_documents = seeker.other_documents.filter(
        (document) => !removeDocumentIds.includes(document._id.toString()),
      );
    }

    // --------------------------------------------------
    // Check whether anything was provided
    // --------------------------------------------------

    const hasBodyFields = Object.keys(req.body).length > 0;

    const hasFiles = Boolean(
      profilePhoto || resume || otherDocumentFiles.length > 0,
    );

    if (!hasBodyFields && !hasFiles) {
      return res.status(400).json({
        status: "error",
        message: "No profile information provided",
      });
    }

    // --------------------------------------------------
    // Save
    // --------------------------------------------------

    await seeker.save();

    // Delete old files only after successful DB save

    if (previousProfilePhoto) {
      deleteFile(previousProfilePhoto);
    }

    if (previousResume) {
      deleteFile(previousResume);
    }

    documentsToDelete.forEach((fileUrl) => {
      deleteFile(fileUrl);
    });

    const profileData = formatProfileResponse(seeker);

    return res.status(200).json({
      status: "success",
      message: "Profile updated successfully",
      ...profileData,
    });
  } catch (error) {
    console.error("Update seeker profile error:", error);

    cleanupUploadedFiles(req.files);

    if (error.statusCode === 400) {
      return res.status(400).json({
        status: "error",
        message: error.message,
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        status: "error",
        message: error.message,
      });
    }

    return res.status(500).json({
      status: "error",
      message: "Failed to update seeker profile",
    });
  }
};
