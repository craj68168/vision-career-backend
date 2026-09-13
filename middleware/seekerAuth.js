const jwt = require("jsonwebtoken");

const seekerAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        status: "error",
        message: "Authorization token is required",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "seeker") {
      return res.status(403).json({
        status: "error",
        message: "Access denied",
      });
    }

    req.user = {
      seeker_id: decoded.seeker_id,
      role: decoded.role,
    };

    next();
  } catch (error) {
    console.error("Seeker authentication error:", error);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        status: "error",
        message: "Token has expired",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        status: "error",
        message: "Invalid token",
      });
    }

    return res.status(500).json({
      status: "error",
      message: "Authentication failed",
    });
  }
};

module.exports = seekerAuth;





// upload.js
// const multer = require("multer");
// const path = require("path");
// const fs = require("fs");
// const crypto = require("crypto");

// // ======================================================
// // UPLOAD DIRECTORY
// // ======================================================

// const uploadPath = path.join(__dirname, "../uploads");

// if (!fs.existsSync(uploadPath)) {
//   fs.mkdirSync(uploadPath, {
//     recursive: true,
//   });
// }

// // ======================================================
// // STORAGE
// // ======================================================

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, uploadPath);
//   },

//   filename: (req, file, cb) => {
//     const extension = path.extname(file.originalname).toLowerCase();

//     const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extension}`;

//     cb(null, uniqueName);
//   },
// });

// // ======================================================
// // ALLOWED FILES
// // ======================================================

// const allowedMimeTypes = [
//   "image/jpeg",
//   "image/png",
//   "image/gif",
//   "image/webp",
//   "application/pdf",
//   "application/msword",
//   "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
// ];

// const allowedExtensions = [
//   ".jpg",
//   ".jpeg",
//   ".png",
//   ".gif",
//   ".webp",
//   ".pdf",
//   ".doc",
//   ".docx",
// ];

// // ======================================================
// // FILE FILTER
// // ======================================================

// const fileFilter = (req, file, cb) => {
//   const extension = path.extname(file.originalname).toLowerCase();

//   const mimeAllowed = allowedMimeTypes.includes(file.mimetype);

//   const extensionAllowed =
//     allowedExtensions.includes(extension);

//   if (mimeAllowed && extensionAllowed) {
//     return cb(null, true);
//   }

//   return cb(
//     new Error(
//       "Only JPG, JPEG, PNG, GIF, WEBP, PDF, DOC and DOCX files are allowed",
//     ),
//     false,
//   );
// };

// // ======================================================
// // MULTER
// // ======================================================

// const upload = multer({
//   storage,

//   fileFilter,

//   limits: {
//     fileSize: 10 * 1024 * 1024,
//   },
// });

// module.exports = upload;