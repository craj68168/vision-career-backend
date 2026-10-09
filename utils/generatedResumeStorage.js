const fs = require("fs");
const path = require("path");

const {
  deleteFile,
  getPrivateFileObject,
} = require("../services/storageService");

const { getStorageKey, isStorageReference } = require("./storageReference");

const { GENERATED_RESUME_DIR } = require("../services/resumeService");

// ======================================================
// ERROR HELPER
// ======================================================

const createStorageError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// ======================================================
// EXPECTED PRIVATE STORAGE PREFIX
// ======================================================

const getGeneratedResumePrefix = (seekerId) => {
  if (!seekerId) {
    return null;
  }

  return `seekers/${seekerId}/generated-resume/`;
};

// ======================================================
// VALIDATE PRIVATE STORAGE REFERENCE
// ======================================================

const getValidatedStorageKey = (storedPath, seekerId) => {
  if (!isStorageReference(storedPath)) {
    return null;
  }

  const key = getStorageKey(storedPath);
  const expectedPrefix = getGeneratedResumePrefix(seekerId);

  if (!key || !expectedPrefix || !key.startsWith(expectedPrefix)) {
    throw createStorageError("Generated resume access denied.", 403);
  }

  return key;
};

// ======================================================
// LEGACY LOCAL GENERATED RESUME
//
// Older records may contain:
// generated-resumes/SKR-....pdf
// /private_uploads/generated-resumes/SKR-....pdf
// ======================================================

const getLegacyGeneratedResumePath = (storedPath) => {
  if (!storedPath) {
    return null;
  }

  const normalized = String(storedPath).replace(/\\/g, "/");

  const allowed =
    normalized.startsWith("generated-resumes/") ||
    normalized.startsWith("/private_uploads/generated-resumes/");

  if (!allowed) {
    return null;
  }

  const fileName = path.basename(normalized);
  const absolutePath = path.resolve(GENERATED_RESUME_DIR, fileName);
  const allowedDirectory = path.resolve(GENERATED_RESUME_DIR);
  const allowedPrefix = `${allowedDirectory}${path.sep}`;

  if (
    absolutePath !== allowedDirectory &&
    !absolutePath.startsWith(allowedPrefix)
  ) {
    throw createStorageError("Generated resume access denied.", 403);
  }

  return absolutePath;
};

// ======================================================
// SEND PRIVATE STORAGE RESUME
// ======================================================

const sendStorageResume = async ({ res, storedPath, seekerId }) => {
  const key = getValidatedStorageKey(storedPath, seekerId);
  const object = await getPrivateFileObject(key);

  res.setHeader("Content-Type", object.ContentType || "application/pdf");
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (object.ContentLength !== undefined) {
    res.setHeader("Content-Length", String(object.ContentLength));
  }

  res.setHeader(
    "Content-Disposition",
    `inline; filename*=UTF-8''${encodeURIComponent(
      `${seekerId}-rirekisho.pdf`,
    )}`,
  );

  if (object.Body && typeof object.Body.transformToByteArray === "function") {
    const bytes = await object.Body.transformToByteArray();
    res.end(Buffer.from(bytes));
    return;
  }

  if (object.Body && typeof object.Body.pipe === "function") {
    object.Body.on("error", (error) => {
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Failed to stream generated resume.",
        });
        return;
      }

      res.destroy(error);
    });

    object.Body.pipe(res);
    return;
  }

  throw createStorageError("Generated resume file body is unavailable.", 404);
};

// ======================================================
// SEND LEGACY LOCAL RESUME
// ======================================================

const sendLegacyResume = async ({ res, storedPath, seekerId }) => {
  const absolutePath = getLegacyGeneratedResumePath(storedPath);

  if (!absolutePath) {
    throw createStorageError("Generated resume is not available.", 404);
  }

  try {
    await fs.promises.access(absolutePath);
  } catch {
    throw createStorageError("Generated resume file not found.", 404);
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader(
    "Content-Disposition",
    `inline; filename*=UTF-8''${encodeURIComponent(
      `${seekerId}-rirekisho.pdf`,
    )}`,
  );

  res.sendFile(absolutePath);
};

// ======================================================
// SEND GENERATED RESUME
// ======================================================

const sendGeneratedResume = async ({ res, storedPath, seekerId }) => {
  if (!storedPath) {
    throw createStorageError("Generated resume is not available.", 404);
  }

  if (!seekerId) {
    throw createStorageError("Seeker ID is required.", 400);
  }

  if (isStorageReference(storedPath)) {
    await sendStorageResume({
      res,
      storedPath,
      seekerId,
    });
    return;
  }

  await sendLegacyResume({
    res,
    storedPath,
    seekerId,
  });
};

// ======================================================
// DELETE GENERATED RESUME REFERENCE
// ======================================================

const deleteGeneratedResumeReference = async ({ storedPath, seekerId }) => {
  if (!storedPath) {
    return;
  }

  if (isStorageReference(storedPath)) {
    const key = getValidatedStorageKey(storedPath, seekerId);
    await deleteFile(key);
    return;
  }

  const absolutePath = getLegacyGeneratedResumePath(storedPath);

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

module.exports = {
  deleteGeneratedResumeReference,
  sendGeneratedResume,
};
