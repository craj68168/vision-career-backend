const crypto = require("crypto");
const {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const storageClient = require("../config/storage");

// ======================================================
// BUCKET
// ======================================================

const bucketName = process.env.SUPABASE_STORAGE_BUCKET;

if (!bucketName) {
  throw new Error("SUPABASE_STORAGE_BUCKET is required");
}

// ======================================================
// SANITIZE FILE NAME
// ======================================================

const sanitizeFileName = (fileName) => {
  return String(fileName)
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");
};

// ======================================================
// CREATE STORAGE KEY
// ======================================================

const createStorageKey = ({ folder, fileName }) => {
  const id = crypto.randomUUID();
  const safeName = sanitizeFileName(fileName);
  return `${folder}/${id}-${safeName}`;
};

// ======================================================
// UPLOAD BUFFER
// ======================================================

const uploadBuffer = async ({ buffer, fileName, mimeType, folder }) => {
  if (!buffer) {
    throw new Error("File buffer is required");
  }

  if (!fileName) {
    throw new Error("File name is required");
  }

  if (!folder) {
    throw new Error("Storage folder is required");
  }

  const key = createStorageKey({
    folder,
    fileName,
  });

  await storageClient.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: mimeType || "application/octet-stream",
    }),
  );

  return {
    key,
    originalName: fileName,
    mimeType: mimeType || "application/octet-stream",
    size: buffer.length,
  };
};

// ======================================================
// UPLOAD MULTER FILE
// ======================================================

const uploadMulterFile = async ({ file, folder }) => {
  if (!file) {
    throw new Error("File is required");
  }

  if (!file.buffer) {
    throw new Error("File buffer is missing. Multer must use memoryStorage().");
  }

  return uploadBuffer({
    buffer: file.buffer,
    fileName: file.originalname,
    mimeType: file.mimetype,
    folder,
  });
};

// ======================================================
// DELETE FILE
// ======================================================

const deleteFile = async (key) => {
  if (!key) {
    return;
  }

  await storageClient.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
  );
};

// ======================================================
// CREATE PRIVATE SIGNED URL
//
// Default expiry:
// 5 minutes
// ======================================================

const getPrivateFileUrl = async ({ key, expiresIn = 300 }) => {
  if (!key) {
    throw new Error("Storage key is required");
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return getSignedUrl(storageClient, command, {
    expiresIn,
  });
};

module.exports = {
  uploadBuffer,
  uploadMulterFile,
  deleteFile,
  getPrivateFileUrl,
};
