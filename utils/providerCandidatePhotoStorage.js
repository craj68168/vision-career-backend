const fs = require("fs");
const path = require("path");

const { getPrivateFileObject } = require("../services/storageService");

const { getStorageKey, isStorageReference } = require("./storageReference");

// ======================================================
// ERROR HELPER
// ======================================================

const createPhotoError = (message, statusCode) => {
  const error = new Error(message);

  error.statusCode = statusCode;

  return error;
};

// ======================================================
// MIME TYPE
// ======================================================

const getImageMimeType = (filePath) => {
  const extension = path.extname(filePath).toLowerCase();

  const types = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  };

  return types[extension] || null;
};

// ======================================================
// RESPONSE HEADERS
//
// Important:
//
// - image is private
// - browser should not permanently cache it
// - Provider never receives the original storage URL
// ======================================================

const setPhotoHeaders = (res, contentType) => {
  res.setHeader("Content-Type", contentType || "application/octet-stream");

  res.setHeader("Cache-Control", "private, no-store, max-age=0");

  res.setHeader("Pragma", "no-cache");

  res.setHeader("X-Content-Type-Options", "nosniff");

  res.setHeader("Content-Disposition", 'inline; filename="candidate-photo"');
};

// ======================================================
// SEND PRIVATE STORAGE PHOTO
//
// Expected storage path:
//
// storage://profile-images/SKR-XXXXXXXX/...
// ======================================================

const sendStoragePhoto = async ({ res, storedPath, seekerId }) => {
  const key = getStorageKey(storedPath);

  if (!key) {
    throw createPhotoError("Candidate photo is not available.", 404);
  }

  // ====================================================
  // IMPORTANT SECURITY CHECK
  //
  // A Provider must never be able to pass an arbitrary
  // private-storage key.
  //
  // The photo must belong to the Seeker associated with
  // the Provider's approved application.
  // ====================================================

  const expectedPrefix = `profile-images/${seekerId}/`;

  if (!key.startsWith(expectedPrefix)) {
    throw createPhotoError("Candidate photo access denied.", 403);
  }

  const object = await getPrivateFileObject(key);

  const contentType = object.ContentType || getImageMimeType(key);

  if (!contentType || !contentType.startsWith("image/")) {
    throw createPhotoError("Candidate photo file is invalid.", 403);
  }

  setPhotoHeaders(res, contentType);

  if (object.ContentLength !== undefined) {
    res.setHeader("Content-Length", String(object.ContentLength));
  }

  // ====================================================
  // AWS / SUPABASE S3-COMPATIBLE BODY
  // ====================================================

  if (object.Body && typeof object.Body.transformToByteArray === "function") {
    const bytes = await object.Body.transformToByteArray();

    res.end(Buffer.from(bytes));

    return;
  }

  // ====================================================
  // STREAM BODY
  // ====================================================

  if (object.Body && typeof object.Body.pipe === "function") {
    object.Body.on("error", (error) => {
      if (!res.headersSent) {
        res.status(500).json({
          status: "error",

          message: "Failed to stream candidate photo.",
        });

        return;
      }

      res.destroy(error);
    });

    object.Body.pipe(res);

    return;
  }

  throw createPhotoError("Candidate photo is unavailable.", 404);
};

// ======================================================
// LEGACY LOCAL PHOTO
//
// Supports older records such as:
//
// /uploads/...
// uploads/...
// /private_uploads/...
//
// New uploads should normally use storage://...
// ======================================================

const sendLegacyLocalPhoto = async ({ res, storedPath }) => {
  const normalized = String(storedPath).replace(/\\/g, "/").replace(/^\/+/, "");

  const allowed =
    normalized.startsWith("uploads/") ||
    normalized.startsWith("private_uploads/");

  if (!allowed) {
    throw createPhotoError("Candidate photo access denied.", 403);
  }

  const absolutePath = path.resolve(process.cwd(), normalized);

  const allowedRoots = [
    path.resolve(process.cwd(), "uploads"),

    path.resolve(process.cwd(), "private_uploads"),
  ];

  const insideAllowedDirectory = allowedRoots.some(
    (root) =>
      absolutePath === root || absolutePath.startsWith(`${root}${path.sep}`),
  );

  if (!insideAllowedDirectory) {
    throw createPhotoError("Candidate photo access denied.", 403);
  }

  try {
    await fs.promises.access(absolutePath, fs.constants.R_OK);
  } catch {
    throw createPhotoError("Candidate photo file not found.", 404);
  }

  const contentType = getImageMimeType(absolutePath);

  if (!contentType) {
    throw createPhotoError("Candidate photo file is invalid.", 403);
  }

  setPhotoHeaders(res, contentType);

  const stat = await fs.promises.stat(absolutePath);

  res.setHeader("Content-Length", String(stat.size));

  const stream = fs.createReadStream(absolutePath);

  stream.on("error", (error) => {
    if (!res.headersSent) {
      res.status(500).json({
        status: "error",

        message: "Failed to stream candidate photo.",
      });

      return;
    }

    res.destroy(error);
  });

  stream.pipe(res);
};

// ======================================================
// SEND PROVIDER CANDIDATE PHOTO
// ======================================================

const sendProviderCandidatePhoto = async ({ res, storedPath, seekerId }) => {
  if (!storedPath) {
    throw createPhotoError("Candidate photo is not available.", 404);
  }

  if (!seekerId) {
    throw createPhotoError("Candidate information is unavailable.", 404);
  }

  if (isStorageReference(storedPath)) {
    await sendStoragePhoto({
      res,
      storedPath,
      seekerId,
    });

    return;
  }

  await sendLegacyLocalPhoto({
    res,
    storedPath,
  });
};

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  sendProviderCandidatePhoto,
};
