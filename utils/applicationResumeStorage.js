const fs = require("fs");
const path = require("path");

const {
  deleteFile,
  getPrivateFileObject,
} = require("../services/storageService");

const { getStorageKey, isStorageReference } = require("./storageReference");

const { APPLICATION_RESUME_DIR } = require("../services/resumeService");

// ======================================================
// ERROR HELPER
// ======================================================

const createStorageError = (message, statusCode) => {
  const error = new Error(message);

  error.statusCode = statusCode;

  return error;
};

// ======================================================
// COMMON PRIVATE FILE HEADERS
// ======================================================

const setPrivateResumeHeaders = (res) => {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");

  res.setHeader("Pragma", "no-cache");

  res.setHeader("X-Content-Type-Options", "nosniff");
};

// ======================================================
// EXPECTED STORAGE PREFIX
//
// Every new frozen application resume must live inside:
//
// applications/APP-XXXXXXXX/resume/...
//
// This prevents one application from reading another
// application's resume through a forged storage path.
// ======================================================

const getApplicationResumePrefix = (applicationId) => {
  if (!applicationId) {
    return null;
  }

  return `applications/${applicationId}/resume/`;
};

// ======================================================
// VALIDATE PRIVATE STORAGE REFERENCE
// ======================================================

const getValidatedStorageKey = (storedPath, applicationId) => {
  if (!isStorageReference(storedPath)) {
    return null;
  }

  const key = getStorageKey(storedPath);

  const expectedPrefix = getApplicationResumePrefix(applicationId);

  if (!key || !expectedPrefix || !key.startsWith(expectedPrefix)) {
    throw createStorageError("Application resume access denied.", 403);
  }

  return key;
};

// ======================================================
// LEGACY APPLICATION RESUME PATH
//
// Older records may still use:
//
// application-resumes/APP-XXXXXXXX.pdf
//
// Keep this compatibility until all old application
// resumes have been migrated or are no longer needed.
// ======================================================

const getLegacyApplicationResumePath = (storedPath, applicationId) => {
  if (!storedPath || !applicationId) {
    return null;
  }

  const normalized = String(storedPath).replace(/\\/g, "/").replace(/^\/+/, "");

  if (!normalized.startsWith("application-resumes/")) {
    return null;
  }

  const fileName = path.basename(normalized);

  const expectedFileName = `${applicationId}.pdf`;

  if (fileName !== expectedFileName) {
    throw createStorageError("Application resume access denied.", 403);
  }

  const absolutePath = path.resolve(APPLICATION_RESUME_DIR, fileName);

  const allowedDirectory = path.resolve(APPLICATION_RESUME_DIR);

  const allowedPrefix = `${allowedDirectory}${path.sep}`;

  if (
    absolutePath !== allowedDirectory &&
    !absolutePath.startsWith(allowedPrefix)
  ) {
    throw createStorageError("Application resume access denied.", 403);
  }

  return absolutePath;
};

// ======================================================
// SEND PRIVATE STORAGE APPLICATION RESUME
//
// Supports:
//
// storage://applications/APP-XXXXXXXX/resume/...
//
// The browser never receives the raw storage key.
// The backend retrieves and streams the PDF.
// ======================================================

const sendStorageResume = async ({ res, storedPath, applicationId }) => {
  const key = getValidatedStorageKey(storedPath, applicationId);

  const object = await getPrivateFileObject(key);

  res.setHeader("Content-Type", object.ContentType || "application/pdf");

  // ====================================================
  // PRIVATE / SECURITY HEADERS
  // ====================================================

  setPrivateResumeHeaders(res);

  // ====================================================
  // CONTENT LENGTH
  // ====================================================

  if (object.ContentLength !== undefined) {
    res.setHeader("Content-Length", String(object.ContentLength));
  }

  // ====================================================
  // INLINE PDF
  // ====================================================

  res.setHeader(
    "Content-Disposition",
    `inline; filename*=UTF-8''${encodeURIComponent(`${applicationId}.pdf`)}`,
  );

  // ====================================================
  // AWS SDK V3 BYTE ARRAY BODY
  // ====================================================

  if (object.Body && typeof object.Body.transformToByteArray === "function") {
    const bytes = await object.Body.transformToByteArray();

    res.end(Buffer.from(bytes));

    return;
  }

  // ====================================================
  // NODE STREAM BODY
  // ====================================================

  if (object.Body && typeof object.Body.pipe === "function") {
    object.Body.on("error", (error) => {
      console.error("Application resume stream error:", error);

      if (!res.headersSent) {
        res.status(500).json({
          success: false,

          message: "Failed to stream application resume.",
        });

        return;
      }

      res.destroy(error);
    });

    object.Body.pipe(res);

    return;
  }

  throw createStorageError("Application resume file body is unavailable.", 404);
};

// ======================================================
// SEND LEGACY LOCAL APPLICATION RESUME
//
// Supports:
//
// application-resumes/APP-XXXXXXXX.pdf
// ======================================================

const sendLegacyResume = async ({ res, storedPath, applicationId }) => {
  const absolutePath = getLegacyApplicationResumePath(
    storedPath,
    applicationId,
  );

  if (!absolutePath) {
    throw createStorageError("Application resume is not available.", 404);
  }

  try {
    await fs.promises.access(absolutePath);
  } catch {
    throw createStorageError("Application resume file not found.", 404);
  }

  res.setHeader("Content-Type", "application/pdf");

  // ====================================================
  // PRIVATE / SECURITY HEADERS
  // ====================================================

  setPrivateResumeHeaders(res);

  res.setHeader(
    "Content-Disposition",
    `inline; filename*=UTF-8''${encodeURIComponent(`${applicationId}.pdf`)}`,
  );

  return res.sendFile(absolutePath);
};

// ======================================================
// SEND APPLICATION RESUME
//
// Supports:
//
// NEW:
// storage://applications/APP-XXXXXXXX/resume/...
//
// LEGACY:
// application-resumes/APP-XXXXXXXX.pdf
//
// This helper only streams a resume after the caller
// has already authenticated and authorized the user.
// ======================================================

const sendApplicationResume = async ({ res, storedPath, applicationId }) => {
  if (!storedPath) {
    throw createStorageError("Application resume is not available.", 404);
  }

  if (!applicationId) {
    throw createStorageError("Application ID is required.", 400);
  }

  // ====================================================
  // NEW PRIVATE STORAGE
  // ====================================================

  if (isStorageReference(storedPath)) {
    await sendStorageResume({
      res,

      storedPath,

      applicationId,
    });

    return;
  }

  // ====================================================
  // LEGACY LOCAL STORAGE
  // ====================================================

  await sendLegacyResume({
    res,

    storedPath,

    applicationId,
  });
};

// ======================================================
// DELETE APPLICATION RESUME REFERENCE
//
// Used mainly when application creation fails after the
// frozen resume has already been uploaded.
//
// Supports both:
//
// - private object storage
// - old local application resumes
// ======================================================

const deleteApplicationResumeReference = async ({
  storedPath,
  applicationId,
}) => {
  if (!storedPath) {
    return;
  }

  // ==================================================
  // PRIVATE OBJECT STORAGE
  // ==================================================

  if (isStorageReference(storedPath)) {
    const key = getValidatedStorageKey(storedPath, applicationId);

    await deleteFile(key);

    return;
  }

  // ==================================================
  // LEGACY LOCAL FILE
  // ==================================================

  const absolutePath = getLegacyApplicationResumePath(
    storedPath,
    applicationId,
  );

  if (!absolutePath) {
    return;
  }

  try {
    await fs.promises.unlink(absolutePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
};

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  deleteApplicationResumeReference,

  sendApplicationResume,
};
