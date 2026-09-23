const multer = require("multer");

// ======================================================
// MEMORY STORAGE
//
// Training files are held temporarily in RAM and then
// uploaded directly to Supabase Storage.
//
// Nothing is permanently written into:
//
// private_uploads/training
// ======================================================

const storage = multer.memoryStorage();

// ======================================================
// ALLOWED MIME TYPES
// ======================================================

const ALLOWED_MIME_TYPES = new Set([
  // PDF
  "application/pdf",

  // Images
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",

  // Video
  "video/mp4",
  "video/webm",
  "video/quicktime",

  // Word
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

  // Excel
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

  // PowerPoint
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",

  // Text
  "text/plain",
  "text/csv",
]);

// ======================================================
// FILE FILTER
// ======================================================

const fileFilter = (req, file, callback) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return callback(new Error("Unsupported training file type."));
  }

  return callback(null, true);
};

// ======================================================
// MULTER
// ======================================================

const upload = multer({
  storage,

  fileFilter,

  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

// ======================================================
// EXPRESS MIDDLEWARE
// ======================================================

const trainingUpload = (req, res, next) => {
  upload.single("file")(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,

        message:
          error.code === "LIMIT_FILE_SIZE"
            ? "Training file cannot exceed 100 MB."
            : error.message,
      });
    }

    return res.status(400).json({
      success: false,

      message: error.message || "Training file upload failed.",
    });
  });
};

module.exports = trainingUpload;
