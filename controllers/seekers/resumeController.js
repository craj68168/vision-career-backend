const Seeker = require("../../models/seekers/seekerSchema");

const {
  generateResumePdf,
  RESUME_AUDIENCES,
} = require("../../services/resumeService");

const { uploadBuffer } = require("../../services/storageService");

const { createStorageReference } = require("../../utils/storageReference");

const {
  deleteGeneratedResumeReference,
  sendGeneratedResume,
} = require("../../utils/generatedResumeStorage");

const { seekerMessage } = require("../../utils/seekerMessages");

const t = (req, en, ja) => seekerMessage(req, { en, ja });

// ======================================================
// GENERATE / REGENERATE JAPANESE-STYLE RESUME
//
// POST /api/seekers/resume/generate
//
// New resumes are stored in private object storage.
// Older local generated resumes remain supported by the
// generatedResumeStorage compatibility helper.
// ======================================================

exports.generateResume = async (req, res) => {
  let newResumeReference = null;

  try {
    const seekerId = req.user.seeker_id;

    const seeker = await Seeker.findOne({
      seeker_id: seekerId,
    });

    if (!seeker) {
      return res.status(404).json({
        success: false,
        message: t(req, "Job Seeker not found.", "求職者が見つかりません。"),
      });
    }

    const previousResume = seeker.generated_resume_file;

    const generatedResume = await generateResumePdf(seeker, {
      type: "profile",
      audience: RESUME_AUDIENCES.INTERNAL,
    });

    const uploadedResume = await uploadBuffer({
      buffer: generatedResume.buffer,
      fileName: generatedResume.fileName,
      mimeType: generatedResume.mimeType || "application/pdf",
      folder: `seekers/${seekerId}/generated-resume`,
    });

    newResumeReference = createStorageReference(uploadedResume.key);

    seeker.generated_resume_file = newResumeReference;

    await seeker.save();

    // The new reference now belongs to the database record.
    const savedResumeReference = newResumeReference;
    newResumeReference = null;

    if (previousResume && previousResume !== savedResumeReference) {
      try {
        await deleteGeneratedResumeReference({
          storedPath: previousResume,
          seekerId,
        });
      } catch (cleanupError) {
        // Generation succeeded. Old-file cleanup failure should not
        // make the new resume unavailable to the seeker.
        console.error("Previous generated resume cleanup error:", cleanupError);
      }
    }

    return res.status(200).json({
      success: true,
      message: t(
        req,
        "Japanese-style resume generated successfully.",
        "日本式の履歴書を作成しました。",
      ),
      data: {
        generated_resume_available: true,
      },
    });
  } catch (error) {
    console.error("Generate resume error:", error);

    if (newResumeReference) {
      try {
        await deleteGeneratedResumeReference({
          storedPath: newResumeReference,
          seekerId: req.user?.seeker_id,
        });
      } catch (cleanupError) {
        console.error("Generated resume rollback cleanup error:", cleanupError);
      }
    }

    return res.status(500).json({
      success: false,
      message: t(
        req,
        "Failed to generate resume.",
        "履歴書の作成に失敗しました。",
      ),
    });
  }
};

// ======================================================
// VIEW LOGGED-IN SEEKER'S GENERATED RESUME
//
// GET /api/seekers/resume/generated
// ======================================================

exports.getGeneratedResume = async (req, res) => {
  try {
    const seekerId = req.user.seeker_id;

    const seeker = await Seeker.findOne({
      seeker_id: seekerId,
    })
      .select("seeker_id generated_resume_file")
      .lean();

    if (!seeker) {
      return res.status(404).json({
        success: false,
        message: t(req, "Job Seeker not found.", "求職者が見つかりません。"),
      });
    }

    if (!seeker.generated_resume_file) {
      return res.status(404).json({
        success: false,
        message: t(
          req,
          "Generated resume not found.",
          "自動生成履歴書が見つかりません。",
        ),
      });
    }

    await sendGeneratedResume({
      res,
      storedPath: seeker.generated_resume_file,
      seekerId,
    });

    return undefined;
  } catch (error) {
    console.error("Get generated resume error:", error);

    if (res.headersSent) {
      return undefined;
    }

    const statusCode =
      error.statusCode || error.$metadata?.httpStatusCode || 500;

    return res.status(statusCode).json({
      success: false,
      message:
        statusCode === 404
          ? t(
              req,
              "Generated resume file not found.",
              "自動生成履歴書ファイルが見つかりません。",
            )
          : statusCode === 403
            ? t(
                req,
                "Generated resume access denied.",
                "自動生成履歴書にアクセスできません。",
              )
            : t(
                req,
                "Failed to get generated resume.",
                "自動生成履歴書の取得に失敗しました。",
              ),
    });
  }
};
