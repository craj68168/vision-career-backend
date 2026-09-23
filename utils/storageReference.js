const fs = require("fs");
const path = require("path");

const { deleteFile, getPrivateFileUrl } = require("../services/storageService");

// ======================================================
// STORAGE REFERENCE PREFIX
// ======================================================

const STORAGE_PREFIX = "storage://";

// ======================================================
// CREATE STORAGE REFERENCE
// ======================================================

const createStorageReference = (key) => {
  if (!key) {
    return null;
  }

  return `${STORAGE_PREFIX}${key}`;
};

// ======================================================
// CHECK STORAGE REFERENCE
// ======================================================

const isStorageReference = (value) => {
  return typeof value === "string" && value.startsWith(STORAGE_PREFIX);
};

// ======================================================
// GET STORAGE KEY
// ======================================================

const getStorageKey = (value) => {
  if (!isStorageReference(value)) {
    return null;
  }

  return value.slice(STORAGE_PREFIX.length);
};

// ======================================================
// RESOLVE FILE REFERENCE
//
// New Supabase files:
// storage://folder/key
//      ↓
// temporary signed URL
//
// Legacy files:
// /uploads/file.pdf
//      ↓
// returned unchanged
// ======================================================

const resolveFileReference = async (value, expiresIn = 3600) => {
  if (!value) {
    return null;
  }

  if (!isStorageReference(value)) {
    return value;
  }

  const key = getStorageKey(value);

  if (!key) {
    return null;
  }

  return getPrivateFileUrl({
    key,
    expiresIn,
  });
};

// ======================================================
// DELETE LEGACY LOCAL FILE
// ======================================================

const deleteLegacyLocalFile = async (fileUrl) => {
  if (!fileUrl) {
    return;
  }

  const fileName = path.basename(fileUrl);

  const locations = [
    path.join(process.cwd(), "uploads", fileName),

    path.join(process.cwd(), "private_uploads", fileName),
  ];

  await Promise.all(
    locations.map(
      (filePath) =>
        new Promise((resolve) => {
          fs.unlink(filePath, (error) => {
            if (error && error.code !== "ENOENT") {
              console.error("Failed to delete legacy file:", filePath, error);
            }

            resolve();
          });
        }),
    ),
  );
};

// ======================================================
// DELETE FILE REFERENCE
// ======================================================

const deleteFileReference = async (value) => {
  if (!value) {
    return;
  }

  // ====================================================
  // SUPABASE STORAGE FILE
  // ====================================================

  if (isStorageReference(value)) {
    const key = getStorageKey(value);

    if (!key) {
      return;
    }

    await deleteFile(key);

    return;
  }

  // ====================================================
  // LEGACY LOCAL FILE
  // ====================================================

  if (value.startsWith("/uploads/") || value.startsWith("/private_uploads/")) {
    await deleteLegacyLocalFile(value);
  }
};

// ======================================================
// DELETE MULTIPLE REFERENCES SAFELY
// ======================================================

const deleteFileReferences = async (references) => {
  const validReferences = references.filter(Boolean);

  if (validReferences.length === 0) {
    return;
  }

  const results = await Promise.allSettled(
    validReferences.map((reference) => deleteFileReference(reference)),
  );

  results.forEach((result) => {
    if (result.status === "rejected") {
      console.error("Failed to delete stored file:", result.reason);
    }
  });
};

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  STORAGE_PREFIX,

  createStorageReference,

  isStorageReference,

  getStorageKey,

  resolveFileReference,

  deleteFileReference,

  deleteFileReferences,
};
