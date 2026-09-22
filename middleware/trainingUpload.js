const crypto = require("crypto");

const fs = require("fs");

const path = require("path");

const multer = require("multer");

// ======================================================
// DIRECTORY
// ======================================================

const uploadDirectory = path.join(process.cwd(), "private_uploads", "training");

if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, {
    recursive: true,
  });
}

// ======================================================
// STORAGE
// ======================================================

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, uploadDirectory);
  },

  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const randomName = crypto.randomBytes(16).toString("hex");

    callback(null, `${Date.now()}-${randomName}${extension}`);
  },
});

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

  // Basic text data

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
