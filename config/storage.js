const { S3Client } = require("@aws-sdk/client-s3");

const endpoint = process.env.SUPABASE_STORAGE_ENDPOINT;
const region = process.env.SUPABASE_STORAGE_REGION;
const accessKeyId = process.env.SUPABASE_STORAGE_ACCESS_KEY;
const secretAccessKey = process.env.SUPABASE_STORAGE_SECRET_KEY;

if (!endpoint) {
  throw new Error("SUPABASE_STORAGE_ENDPOINT is required");
}

if (!region) {
  throw new Error("SUPABASE_STORAGE_REGION is required");
}

if (!accessKeyId) {
  throw new Error("SUPABASE_STORAGE_ACCESS_KEY is required");
}

if (!secretAccessKey) {
  throw new Error("SUPABASE_STORAGE_SECRET_KEY is required");
}

// ======================================================
// S3 CLIENT
//
// Supabase Storage exposes an S3-compatible API.
// forcePathStyle is important for Supabase.
// ======================================================

const storageClient = new S3Client({
  endpoint,
  region,
  forcePathStyle: true,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

module.exports = storageClient;
