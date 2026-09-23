const multer = require("multer");

// ======================================================
// MEMORY STORAGE
//
// Files are held temporarily in memory.
// They are not written permanently to /uploads.
// ======================================================

const storage = multer.memoryStorage();

// ======================================================
// ALLOWED FILE TYPES
// ======================================================

const allowedMimeTypes = new Set([
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",

  // PDF
  "application/pdf",

  // Word
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

  // Excel
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

  // PowerPoint
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

// ======================================================
// FILE FILTER
// ======================================================

const fileFilter = (req, file, callback) => {
  if (!allowedMimeTypes.has(file.mimetype)) {
    return callback(new Error("Unsupported file type"));
  }

  callback(null, true);
};

// ======================================================
// UPLOAD
// ======================================================

const storageUpload = multer({
  storage,

  fileFilter,

  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

// ======================================================
// EXPORT
// ======================================================

module.exports = storageUpload;
