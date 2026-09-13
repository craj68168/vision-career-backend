const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// ======================================================
// UPLOAD DIRECTORY
// ======================================================

const uploadPath = path.join(__dirname, "../uploads");

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, {
    recursive: true,
  });
}

// ======================================================
// STORAGE
// ======================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extension}`;

    cb(null, uniqueName);
  },
});

// ======================================================
// ALLOWED FILES
// ======================================================

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const allowedExtensions = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".pdf",
  ".doc",
  ".docx",
];

// ======================================================
// FILE FILTER
// ======================================================

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();

  const mimeAllowed = allowedMimeTypes.includes(file.mimetype);

  const extensionAllowed =
    allowedExtensions.includes(extension);

  if (mimeAllowed && extensionAllowed) {
    return cb(null, true);
  }

  return cb(
    new Error(
      "Only JPG, JPEG, PNG, GIF, WEBP, PDF, DOC and DOCX files are allowed",
    ),
    false,
  );
};

// ======================================================
// MULTER
// ======================================================

const upload = multer({
  storage,

  fileFilter,

  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

module.exports = upload;