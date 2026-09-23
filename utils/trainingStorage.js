const fs = require("fs");

const path = require("path");

const {
  deleteFile,
  getPrivateFileObject,
} = require("../services/storageService");

const { getStorageKey, isStorageReference } = require("./storageReference");

// ======================================================
// LEGACY TRAINING DIRECTORY
// ======================================================

const trainingDirectory = path.resolve(
  process.cwd(),

  "private_uploads",

  "training",
);

// ======================================================
// SAFE LEGACY PATH
// ======================================================

const getLegacyTrainingPath = (filePath) => {
  if (!filePath) {
    return null;
  }

  const normalized = String(filePath).replace(/\\/g, "/").replace(/^\/+/, "");

  const absolutePath = path.resolve(process.cwd(), normalized);

  const allowedPrefix = `${trainingDirectory}${path.sep}`;

  if (
    absolutePath !== trainingDirectory &&
    !absolutePath.startsWith(allowedPrefix)
  ) {
    return null;
  }

  return absolutePath;
};

// ======================================================
// DELETE TRAINING FILE
//
// Supports:
//
// storage://training/...
//
// private_uploads/training/...
//
// /private_uploads/training/...
// ======================================================

const deleteTrainingFileReference = async (filePath) => {
  if (!filePath) {
    return;
  }

  // ==================================================
  // SUPABASE STORAGE
  // ==================================================

  if (isStorageReference(filePath)) {
    const key = getStorageKey(filePath);

    if (key) {
      await deleteFile(key);
    }

    return;
  }

  // ==================================================
  // LEGACY LOCAL STORAGE
  // ==================================================

  const absolutePath = getLegacyTrainingPath(filePath);

  if (!absolutePath) {
    console.error("TRAINING FILE PATH OUTSIDE ALLOWED DIRECTORY:", filePath);

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
// SEND STORAGE OBJECT
// ======================================================

const sendStorageObject = async ({
  res,

  filePath,

  mimeType,

  originalFileName,
}) => {
  const key = getStorageKey(filePath);

  if (!key) {
    const error = new Error("Invalid storage reference.");

    error.statusCode = 404;

    throw error;
  }

  const object = await getPrivateFileObject(key);

  res.setHeader(
    "Content-Type",

    object.ContentType || mimeType || "application/octet-stream",
  );

  if (object.ContentLength !== undefined) {
    res.setHeader(
      "Content-Length",

      String(object.ContentLength),
    );
  }

  res.setHeader(
    "Content-Disposition",

    `inline; filename*=UTF-8''${encodeURIComponent(
      originalFileName || "file",
    )}`,
  );

  // ==================================================
  // NODE STREAM
  // ==================================================

  if (object.Body && typeof object.Body.pipe === "function") {
    object.Body.pipe(res);

    return;
  }

  // ==================================================
  // AWS SDK BYTE ARRAY
  // ==================================================

  if (object.Body && typeof object.Body.transformToByteArray === "function") {
    const bytes = await object.Body.transformToByteArray();

    res.end(Buffer.from(bytes));

    return;
  }

  const error = new Error("Training file body is unavailable.");

  error.statusCode = 404;

  throw error;
};

// ======================================================
// SEND LEGACY LOCAL TRAINING FILE
// ======================================================

const sendLegacyTrainingFile = async ({
  res,

  filePath,

  mimeType,

  originalFileName,
}) => {
  const absolutePath = getLegacyTrainingPath(filePath);

  if (!absolutePath) {
    const error = new Error("Invalid training file path.");

    error.statusCode = 403;

    throw error;
  }

  try {
    await fs.promises.access(absolutePath);
  } catch {
    const error = new Error("Training file is missing from storage.");

    error.statusCode = 404;

    throw error;
  }

  res.setHeader(
    "Content-Type",

    mimeType || "application/octet-stream",
  );

  res.setHeader(
    "Content-Disposition",

    `inline; filename*=UTF-8''${encodeURIComponent(
      originalFileName || "file",
    )}`,
  );

  res.sendFile(absolutePath);
};

// ======================================================
// SEND TRAINING FILE
//
// Supports:
//
// NEW:
// storage://training/...
//
// OLD:
// private_uploads/training/...
// ======================================================

const sendTrainingFile = async ({
  res,

  filePath,

  mimeType,

  originalFileName,
}) => {
  if (!filePath) {
    const error = new Error("Training file path is missing.");

    error.statusCode = 404;

    throw error;
  }

  if (isStorageReference(filePath)) {
    await sendStorageObject({
      res,

      filePath,

      mimeType,

      originalFileName,
    });

    return;
  }

  await sendLegacyTrainingFile({
    res,

    filePath,

    mimeType,

    originalFileName,
  });
};

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  deleteTrainingFileReference,

  sendTrainingFile,
};
