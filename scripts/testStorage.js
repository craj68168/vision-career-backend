require("dotenv").config();

const {
  deleteFile,
  getPrivateFileUrl,
  uploadBuffer,
} = require("../services/storageService");

// ======================================================
// TEST
// ======================================================

const run = async () => {
  let uploadedKey = null;

  try {
    console.log("Testing Supabase Storage...");

    // ==================================================
    // CREATE TEMP FILE
    // ==================================================

    const buffer = Buffer.from("Vision Career storage test", "utf8");

    // ==================================================
    // UPLOAD
    // ==================================================

    const uploaded = await uploadBuffer({
      buffer,

      fileName: "storage-test.txt",

      mimeType: "text/plain",

      folder: "storage-tests",
    });

    uploadedKey = uploaded.key;

    console.log("Upload successful:", uploaded);

    // ==================================================
    // SIGNED URL
    // ==================================================

    const signedUrl = await getPrivateFileUrl({
      key: uploaded.key,

      expiresIn: 300,
    });

    console.log("Signed URL created:");

    console.log(signedUrl);

    // ==================================================
    // DELETE TEST FILE
    // ==================================================

    await deleteFile(uploaded.key);

    uploadedKey = null;

    console.log("Delete successful.");

    console.log("Supabase Storage connection is working.");
  } catch (error) {
    console.error("Storage test failed:", error);

    // ==================================================
    // CLEANUP
    // ==================================================

    if (uploadedKey) {
      try {
        await deleteFile(uploadedKey);
      } catch (cleanupError) {
        console.error("Cleanup failed:", cleanupError);
      }
    }

    process.exitCode = 1;
  }
};

run();
