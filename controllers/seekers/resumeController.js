const fs = require("fs");
const path = require("path");

const Seeker = require(
  "../../models/seekers/seekerSchema",
);

const {
  generateResumePdf,
  GENERATED_RESUME_DIR,
} = require(
  "../../services/resumeService",
);

// ======================================================
// GENERATE / REGENERATE RESUME
//
// POST /api/seekers/resume/generate
// ======================================================

exports.generateResume = async (
  req,
  res,
) => {
  let newResumePath = null;

  try {
    const seekerId =
      req.user.seeker_id;

    const seeker =
      await Seeker.findOne({
        seeker_id: seekerId,
      });

    if (!seeker) {
      return res.status(404).json({
        success: false,
        message:
          "Job Seeker not found.",
      });
    }

    // Keep previous generated resume
    // so it can be deleted after successful generation.
    const previousResume =
      seeker.generated_resume_file;

    // Generate latest profile resume
    const generatedResume =
      await generateResumePdf(
        seeker,
      );

    newResumePath =
      generatedResume.absolutePath;

    seeker.generated_resume_file =
      generatedResume.relativePath;

    await seeker.save();

    // ==================================================
    // DELETE PREVIOUS PROFILE RESUME
    // ==================================================
    //
    // Important:
    // This deletes only the seeker's previous
    // generated profile resume.
    //
    // Application-specific resumes will be stored
    // separately and will NOT be deleted here.
    // ==================================================

    if (previousResume) {
      const previousFileName =
        path.basename(
          previousResume,
        );

      const previousAbsolutePath =
        path.join(
          GENERATED_RESUME_DIR,
          previousFileName,
        );

      if (
        fs.existsSync(
          previousAbsolutePath,
        )
      ) {
        fs.unlinkSync(
          previousAbsolutePath,
        );
      }
    }

    return res.status(200).json({
      success: true,

      message:
        "Privacy-safe resume generated successfully.",

      data: {
        generated_resume_file:
          seeker.generated_resume_file,
      },
    });
  } catch (error) {
    console.error(
      "Generate resume error:",
      error,
    );

    // If PDF was generated but database save failed,
    // remove the new file.
    if (
      newResumePath &&
      fs.existsSync(
        newResumePath,
      )
    ) {
      fs.unlinkSync(
        newResumePath,
      );
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate resume.",
    });
  }
};

// ======================================================
// VIEW LOGGED-IN SEEKER'S GENERATED RESUME
//
// GET /api/seekers/resume/generated
// ======================================================

exports.getGeneratedResume = async (
  req,
  res,
) => {
  try {
    const seekerId =
      req.user.seeker_id;

    const seeker =
      await Seeker.findOne({
        seeker_id: seekerId,
      });

    if (!seeker) {
      return res.status(404).json({
        success: false,
        message:
          "Job Seeker not found.",
      });
    }

    if (
      !seeker.generated_resume_file
    ) {
      return res.status(404).json({
        success: false,
        message:
          "Generated resume not found.",
      });
    }

    const fileName =
      path.basename(
        seeker.generated_resume_file,
      );

    const absolutePath =
      path.join(
        GENERATED_RESUME_DIR,
        fileName,
      );

    if (
      !fs.existsSync(
        absolutePath,
      )
    ) {
      return res.status(404).json({
        success: false,
        message:
          "Generated resume file not found.",
      });
    }

    res.setHeader(
      "Content-Type",
      "application/pdf",
    );

    res.setHeader(
      "Content-Disposition",
      `inline; filename="${fileName}"`,
    );

    return res.sendFile(
      absolutePath,
    );
  } catch (error) {
    console.error(
      "Get generated resume error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to get generated resume.",
    });
  }
};