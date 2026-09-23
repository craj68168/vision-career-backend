const path = require("path");

const Seeker = require("../../models/seekers/seekerSchema");

const { uploadMulterFile } = require("../../services/storageService");

const {
  createStorageReference,
  resolveFileReference,
  deleteFileReferences,
} = require("../../utils/storageReference");

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
// PROFILE PHOTO FILE RULES
// ======================================================

const PROFILE_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const PROFILE_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

// ======================================================
// RESUME FILE RULES
// ======================================================

const RESUME_EXTENSIONS = new Set([".pdf", ".doc", ".docx"]);

const RESUME_MIME_TYPES = new Set([
  "application/pdf",

  "application/msword",

  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

// ======================================================
// OTHER DOCUMENT FILE RULES
//
// Preserves the file types supported by the previous
// Multer upload middleware.
// ======================================================

const DOCUMENT_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".pdf",
  ".doc",
  ".docx",
]);

const DOCUMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",

  "application/pdf",

  "application/msword",

  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

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
// RESOLVE OTHER DOCUMENT URLS
// ======================================================

const resolveOtherDocuments = async (documents) => {
  if (!Array.isArray(documents)) {
    return [];
  }

  return Promise.all(
    documents.map(async (document) => {
      const documentObject = document?.toObject
        ? document.toObject()
        : {
            ...document,
          };

      documentObject.file_url = await resolveFileReference(
        documentObject.file_url,
        3600,
      );

      return documentObject;
    }),
  );
};

// ======================================================
// FORMAT PROFILE RESPONSE
// ======================================================

const formatProfileResponse = async (seeker) => {
  const {
    isComplete,

    completionPercentage,

    missingFields,
  } = calculateProfileCompletion(seeker);

  const seekerObject = seeker.toObject();

  const education = seekerObject.education || [];

  const employmentHistory = seekerObject.employment_history || [];

  // ==================================================
  // PRIVATE STORAGE URLS
  // ==================================================

  seekerObject.profile_photo = await resolveFileReference(
    seekerObject.profile_photo,
    3600,
  );

  seekerObject.resume_file = await resolveFileReference(
    seekerObject.resume_file,
    3600,
  );

  seekerObject.generated_resume_file = await resolveFileReference(
    seekerObject.generated_resume_file,
    3600,
  );

  seekerObject.other_documents = await resolveOtherDocuments(
    seekerObject.other_documents,
  );

  // ==================================================
  // REMOVE NESTED ARRAYS FROM PROFILE OBJECT
  // ==================================================

  delete seekerObject.education;

  delete seekerObject.employment_history;

  // ==================================================
  // REMOVE MONGODB INTERNAL FIELDS
  // ==================================================

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
// PARSE MULTIPART JSON FIELD
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
// VALIDATE FILE
// ======================================================

const validateFile = ({
  file,

  allowedExtensions,

  allowedMimeTypes,

  errorMessage,
}) => {
  if (!file) {
    return;
  }

  const extension = path.extname(file.originalname).toLowerCase();

  if (
    !allowedExtensions.has(extension) ||
    !allowedMimeTypes.has(file.mimetype)
  ) {
    const error = new Error(errorMessage);

    error.statusCode = 400;

    throw error;
  }
};

// ======================================================
// CLEAN UP NEW STORAGE FILES
//
// Used when Supabase uploads succeeded but MongoDB save
// later fails.
// ======================================================

const cleanupNewStorageFiles = async (storageReferences) => {
  if (!storageReferences || storageReferences.length === 0) {
    return;
  }

  await deleteFileReferences(storageReferences);
};

// ======================================================
// GET LOGGED-IN SEEKER PROFILE
//
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

    const profileData = await formatProfileResponse(seeker);

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
//
// PATCH /api/seekers/profile
// ======================================================

exports.updateProfile = async (req, res) => {
  // ==================================================
  // TRACK NEW STORAGE FILES
  //
  // If anything fails before MongoDB save completes,
  // these files are removed from Supabase.
  // ==================================================

  const newStorageReferences = [];

  try {
    const seekerId = req.user.seeker_id;

    // =================================================
    // FIND SEEKER
    // =================================================

    const seeker = await Seeker.findOne({
      seeker_id: seekerId,
    });

    if (!seeker) {
      return res.status(404).json({
        status: "error",

        message: "Seeker not found",
      });
    }

    // =================================================
    // NORMAL EDITABLE FIELDS
    // =================================================

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

    // =================================================
    // SKILLS
    // =================================================

    if (req.body.skills !== undefined) {
      const skills = parseJsonField(
        req.body.skills,

        "skills",
      );

      if (!Array.isArray(skills)) {
        return res.status(400).json({
          status: "error",

          message: "Skills must be an array",
        });
      }

      seeker.skills = skills;
    }

    // =================================================
    // EDUCATION
    // =================================================

    if (req.body.education !== undefined) {
      const education = parseJsonField(
        req.body.education,

        "education",
      );

      if (!Array.isArray(education)) {
        return res.status(400).json({
          status: "error",

          message: "Education must be an array",
        });
      }

      seeker.education = education;
    }

    // =================================================
    // EMPLOYMENT HISTORY
    // =================================================

    if (req.body.employment_history !== undefined) {
      const employmentHistory = parseJsonField(
        req.body.employment_history,

        "employment_history",
      );

      if (!Array.isArray(employmentHistory)) {
        return res.status(400).json({
          status: "error",

          message: "Employment history must be an array",
        });
      }

      seeker.employment_history = employmentHistory;
    }

    // =================================================
    // GET UPLOADED FILES
    // =================================================

    const profilePhoto = req.files?.profile_photo?.[0];

    const resume = req.files?.resume?.[0];

    const otherDocumentFiles = req.files?.other_documents || [];

    // =================================================
    // VALIDATE PROFILE PHOTO
    // =================================================

    validateFile({
      file: profilePhoto,

      allowedExtensions: PROFILE_IMAGE_EXTENSIONS,

      allowedMimeTypes: PROFILE_IMAGE_MIME_TYPES,

      errorMessage: "Profile photo must be JPG, JPEG, PNG or WEBP",
    });

    // =================================================
    // VALIDATE RESUME
    // =================================================

    validateFile({
      file: resume,

      allowedExtensions: RESUME_EXTENSIONS,

      allowedMimeTypes: RESUME_MIME_TYPES,

      errorMessage: "Resume must be a PDF, DOC or DOCX file",
    });

    // =================================================
    // VALIDATE OTHER DOCUMENT FILES
    // =================================================

    otherDocumentFiles.forEach((file) => {
      validateFile({
        file,

        allowedExtensions: DOCUMENT_EXTENSIONS,

        allowedMimeTypes: DOCUMENT_MIME_TYPES,

        errorMessage:
          "Documents must be JPG, JPEG, PNG, GIF, WEBP, PDF, DOC or DOCX files",
      });
    });

    // =================================================
    // OTHER DOCUMENT METADATA
    // =================================================

    let documentMeta = [];

    if (req.body.other_documents_meta) {
      documentMeta = parseJsonField(
        req.body.other_documents_meta,

        "other_documents_meta",
      );

      if (!Array.isArray(documentMeta)) {
        return res.status(400).json({
          status: "error",

          message: "other_documents_meta must be an array",
        });
      }
    }

    if (
      documentMeta.length > 0 &&
      documentMeta.length !== otherDocumentFiles.length
    ) {
      return res.status(400).json({
        status: "error",

        message: "Document metadata count must match uploaded document count",
      });
    }

    // =================================================
    // DOCUMENTS TO DELETE AFTER SUCCESSFUL SAVE
    // =================================================

    const documentsToDelete = [];

    if (!Array.isArray(seeker.other_documents)) {
      seeker.other_documents = [];
    }

    // =================================================
    // REMOVE EXISTING DOCUMENTS
    // =================================================

    if (req.body.remove_document_ids !== undefined) {
      const removeDocumentIds = parseJsonField(
        req.body.remove_document_ids,

        "remove_document_ids",
      );

      if (!Array.isArray(removeDocumentIds)) {
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

    // =================================================
    // CHECK WHETHER ANYTHING WAS PROVIDED
    // =================================================

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

    // =================================================
    // PREVIOUS FILE REFERENCES
    // =================================================

    let previousProfilePhoto = null;

    let previousResume = null;

    // =================================================
    // UPLOAD PROFILE PHOTO
    // =================================================

    if (profilePhoto) {
      const uploaded = await uploadMulterFile({
        file: profilePhoto,

        folder: `profile-images/${seekerId}`,
      });

      const reference = createStorageReference(uploaded.key);

      newStorageReferences.push(reference);

      previousProfilePhoto = seeker.profile_photo;

      seeker.profile_photo = reference;
    }

    // =================================================
    // UPLOAD RESUME
    // =================================================

    if (resume) {
      const uploaded = await uploadMulterFile({
        file: resume,

        folder: `resumes/${seekerId}`,
      });

      const reference = createStorageReference(uploaded.key);

      newStorageReferences.push(reference);

      previousResume = seeker.resume_file;

      seeker.resume_file = reference;
    }

    // =================================================
    // UPLOAD OTHER DOCUMENTS
    // =================================================

    for (let index = 0; index < otherDocumentFiles.length; index += 1) {
      const file = otherDocumentFiles[index];

      const meta = documentMeta[index] || {};

      const uploaded = await uploadMulterFile({
        file,

        folder: `seeker-documents/${seekerId}`,
      });

      const reference = createStorageReference(uploaded.key);

      newStorageReferences.push(reference);

      seeker.other_documents.push({
        name: meta.name || file.originalname,

        document_type: meta.document_type || "other",

        file_url: reference,
      });
    }

    // =================================================
    // SAVE MONGODB
    // =================================================

    await seeker.save();

    // =================================================
    // DATABASE SAVE SUCCEEDED
    //
    // New storage files are now permanent.
    // Do not clean them up in catch.
    // =================================================

    newStorageReferences.length = 0;

    // =================================================
    // DELETE REPLACED / REMOVED OLD FILES
    //
    // Supports both:
    //
    // storage://...
    // /uploads/...
    // =================================================

    await deleteFileReferences([
      previousProfilePhoto,

      previousResume,

      ...documentsToDelete,
    ]);

    // =================================================
    // RESPONSE
    // =================================================

    const profileData = await formatProfileResponse(seeker);

    return res.status(200).json({
      status: "success",

      message: "Profile updated successfully",

      ...profileData,
    });
  } catch (error) {
    console.error("Update seeker profile error:", error);

    // =================================================
    // REMOVE ANY NEW SUPABASE FILES IF UPDATE FAILED
    // =================================================

    await cleanupNewStorageFiles(newStorageReferences);

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
