const bcrypt = require("bcryptjs");

const crypto = require("crypto");

const Seeker = require("../../models/seekers/seekerSchema");

const Application = require("../../models/applications/applicationSchema");

const { resolveFileReference } = require("../../utils/storageReference");

const {
  calculatePlacementEligibility,
} = require("../../utils/seekerProfileStatus");

const {
  sendSeekerApprovalEmail,
  sendSeekerAccountCreatedEmail,
} = require("../../utils/seekerEmail");

// ======================================================
// CONSTANTS
// ======================================================

const PLACEMENT_STATUSES = [
  "unplaced",
  "matching",
  "interview",
  "selected",
  "placed",
];

const PASSWORD_SETUP_EXPIRY_MINUTES = 60;

// ======================================================
// GENERATE UNIQUE SEEKER ID
// ======================================================

const generateUniqueSeekerId = async () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const seekerId = `SKR-${crypto
      .randomBytes(4)
      .toString("hex")
      .toUpperCase()}`;

    const exists = await Seeker.exists({
      seeker_id: seekerId,
    });

    if (!exists) {
      return seekerId;
    }
  }

  throw new Error("Unable to generate unique seeker ID.");
};

// ======================================================
// NORMALIZE OPTIONAL STRING
// ======================================================

const normalizeOptionalString = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();

  return normalized || null;
};

// ======================================================
// EMAIL VALIDATION
// ======================================================

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// ======================================================
// PHONE VALIDATION
// ======================================================

const isValidPhone = (phone) => {
  const normalized = String(phone || "").trim();

  if (!/^[+\d\s()-]+$/.test(normalized)) {
    return false;
  }

  const digits = normalized.replace(/\D/g, "");

  return digits.length >= 7 && digits.length <= 15;
};

// ======================================================
// CREATE SETUP TOKEN
// ======================================================

const createPasswordSetupToken = () => {
  const rawToken = crypto.randomBytes(32).toString("hex");

  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  const expiresAt = new Date(
    Date.now() + PASSWORD_SETUP_EXPIRY_MINUTES * 60 * 1000,
  );

  return {
    rawToken,

    tokenHash,

    expiresAt,
  };
};

// ======================================================
// RESOLVE OTHER DOCUMENTS
// ======================================================

const resolveOtherDocuments = async (documents = []) => {
  if (!Array.isArray(documents)) {
    return [];
  }

  return Promise.all(
    documents.map(async (document) => {
      const item =
        typeof document?.toObject === "function"
          ? document.toObject()
          : {
              ...document,
            };

      return {
        ...item,

        file_url: await resolveFileReference(item.file_url, 3600),
      };
    }),
  );
};

// ======================================================
// SAFE ADMIN SERIALIZER
// ======================================================

const serializeSeeker = async (seeker, applicationsCount = 0) => {
  const item =
    typeof seeker.toObject === "function"
      ? seeker.toObject()
      : {
          ...seeker,
        };

  delete item.password;

  delete item.password_reset_code_hash;

  delete item.password_reset_code_expires;

  delete item.password_reset_attempts;

  delete item.password_reset_token_hash;

  delete item.password_reset_token_expires;

  delete item.__v;

  item.profile_photo = await resolveFileReference(item.profile_photo, 3600);

  item.resume_file = await resolveFileReference(item.resume_file, 3600);

  item.generated_resume_file = await resolveFileReference(
    item.generated_resume_file,
    3600,
  );

  item.other_documents = await resolveOtherDocuments(item.other_documents);

  const eligibility = calculatePlacementEligibility(seeker);

  return {
    ...item,

    applications_count: applicationsCount,

    profile_status: eligibility.profile.isComplete ? "COMPLETE" : "INCOMPLETE",

    completion_percentage: eligibility.profile.completionPercentage,

    missing_fields: eligibility.profile.missingFields,

    placement_eligible: eligibility.isEligible,

    placement_eligibility: {
      status: eligibility.status,

      reasons: eligibility.reasons,
    },
  };
};

// ======================================================
// CREATE SEEKER BY ADMIN
//
// POST /api/admin/seekers
//
// Admin DOES NOT create seeker password.
//
// Required:
// - name
// - email
// - phone
//
// Everything else may be completed now or later.
// ======================================================

exports.createSeeker = async (req, res) => {
  try {
    const {
      name,

      email,

      phone,

      address = null,

      current_location = null,

      date_of_birth = null,

      gender = null,

      nationality = null,

      visa_type = null,

      visa_expiry_date = null,

      japanese_level = null,

      skills = [],

      desired_job = null,

      desired_location = null,

      available_from = null,

      education = [],

      employment_history = [],

      notes = null,

      placement_status = "unplaced",
    } = req.body;

    // ==================================================
    // REQUIRED
    // ==================================================

    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,

        message: "Name, email and phone number are required.",
      });
    }

    // ==================================================
    // EMAIL
    // ==================================================

    const normalizedEmail = String(email).trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,

        message: "Please enter a valid email address.",
      });
    }

    // ==================================================
    // PHONE
    // ==================================================

    const normalizedPhone = String(phone).trim();

    if (!isValidPhone(normalizedPhone)) {
      return res.status(400).json({
        success: false,

        message: "Please enter a valid phone number.",
      });
    }

    // ==================================================
    // DUPLICATE EMAIL
    // ==================================================

    const existing = await Seeker.findOne({
      email: normalizedEmail,
    });

    if (existing) {
      return res.status(409).json({
        success: false,

        message: "A job seeker with this email already exists.",
      });
    }

    // ==================================================
    // ARRAYS
    // ==================================================

    if (!Array.isArray(skills)) {
      return res.status(400).json({
        success: false,

        message: "Skills must be an array.",
      });
    }

    if (!Array.isArray(education)) {
      return res.status(400).json({
        success: false,

        message: "Education must be an array.",
      });
    }

    if (!Array.isArray(employment_history)) {
      return res.status(400).json({
        success: false,

        message: "Employment history must be an array.",
      });
    }

    // ==================================================
    // PLACEMENT STATUS
    // ==================================================

    if (!PLACEMENT_STATUSES.includes(placement_status)) {
      return res.status(400).json({
        success: false,

        message: "Invalid placement status.",
      });
    }

    // ==================================================
    // INTERNAL RANDOM PASSWORD
    //
    // Admin never sees or knows this password.
    // ==================================================

    const internalPassword = crypto.randomBytes(32).toString("hex");

    const salt = await bcrypt.genSalt(12);

    const hashedPassword = await bcrypt.hash(internalPassword, salt);

    // ==================================================
    // SEEKER ID
    // ==================================================

    const seekerId = await generateUniqueSeekerId();

    // ==================================================
    // PASSWORD SETUP TOKEN
    // ==================================================

    const { rawToken, tokenHash, expiresAt } = createPasswordSetupToken();

    // ==================================================
    // CREATE SEEKER OBJECT
    // ==================================================

    const seeker = new Seeker({
      seeker_id: seekerId,

      name: String(name).trim(),

      email: normalizedEmail,

      phone: normalizedPhone,

      password: hashedPassword,

      account_source: "admin",

      password_setup_required: true,

      password_reset_token_hash: tokenHash,

      password_reset_token_expires: expiresAt,

      address: normalizeOptionalString(address),

      current_location: normalizeOptionalString(current_location),

      date_of_birth: date_of_birth || null,

      gender: normalizeOptionalString(gender),

      nationality: normalizeOptionalString(nationality),

      visa_type: normalizeOptionalString(visa_type),

      visa_expiry_date: visa_expiry_date || null,

      japanese_level: normalizeOptionalString(japanese_level),

      skills: skills.map((skill) => String(skill).trim()).filter(Boolean),

      desired_job: normalizeOptionalString(desired_job),

      desired_location: normalizeOptionalString(desired_location),

      available_from: available_from || null,

      education,

      employment_history,

      notes: normalizeOptionalString(notes),

      placement_status,

      approval_status: "pending",

      account_status: "inactive",
    });

    // ==================================================
    // ADMIN-CREATED ACCOUNTS ARE APPROVED IMMEDIATELY
    // ==================================================

    seeker.recordApprovalDecision({
      decision: "approved",

      actorType: "admin",

      actorId: req.admin.adminId,

      actorName: req.admin.username,

      reason: null,
    });

    await seeker.save();

    // ==================================================
    // SEND ACCOUNT CREATED EMAIL
    //
    // Do not delete the account if email sending fails.
    // ==================================================

    let emailSent = false;

    let emailWarning = null;

    try {
      await sendSeekerAccountCreatedEmail({
        seeker,

        setupToken: rawToken,

        expiresMinutes: PASSWORD_SETUP_EXPIRY_MINUTES,
      });

      emailSent = true;
    } catch (emailError) {
      console.error("SEEKER ACCOUNT CREATED EMAIL ERROR:", emailError);

      emailWarning =
        "The seeker account was created, but the account setup email could not be sent.";
    }

    // ==================================================
    // RESPONSE
    // ==================================================

    const data = await serializeSeeker(seeker, 0);

    return res.status(201).json({
      success: true,

      message: emailSent
        ? "Job seeker created successfully. A password setup email has been sent."
        : "Job seeker created successfully, but the password setup email could not be sent.",

      email_sent: emailSent,

      warning: emailWarning,

      data,
    });
  } catch (error) {
    console.error("CREATE ADMIN SEEKER ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,

        message: "Email or seeker ID already exists.",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,

        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,

      message: "Failed to create job seeker.",
    });
  }
};

// ======================================================
// ADMIN APPROVE / REJECT SEEKER
//
// PATCH /api/admin/seekers/:seekerId/approval
// ======================================================

exports.updateApprovalStatus = async (req, res) => {
  try {
    const { seekerId } = req.params;

    const { decision, reason = null } = req.body;

    // ==================================================
    // VALIDATE DECISION
    // ==================================================

    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({
        success: false,

        message: "Decision must be approved or rejected.",
      });
    }

    const normalizedReason = typeof reason === "string" ? reason.trim() : "";

    if (decision === "rejected" && !normalizedReason) {
      return res.status(400).json({
        success: false,

        message: "Rejection reason is required.",
      });
    }

    if (normalizedReason.length > 2000) {
      return res.status(400).json({
        success: false,

        message: "Rejection reason cannot exceed 2000 characters.",
      });
    }

    // ==================================================
    // FIND SEEKER
    // ==================================================

    const seeker = await Seeker.findOne({
      seeker_id: seekerId,
    });

    if (!seeker) {
      return res.status(404).json({
        success: false,

        message: "Job seeker not found.",
      });
    }

    const wasApproved = seeker.approval_status === "approved";

    // ==================================================
    // RECORD DECISION
    // ==================================================

    seeker.recordApprovalDecision({
      decision,

      actorType: "admin",

      actorId: req.admin.adminId,

      actorName: req.admin.username,

      reason: normalizedReason,
    });

    await seeker.save();

    // ==================================================
    // SEND APPROVAL EMAIL ONLY ON NEW APPROVAL
    // ==================================================

    let emailSent = false;

    let emailWarning = null;

    if (decision === "approved" && !wasApproved) {
      try {
        await sendSeekerApprovalEmail(seeker);

        emailSent = true;
      } catch (emailError) {
        console.error("SEEKER APPROVAL EMAIL ERROR:", emailError);

        emailWarning =
          "The seeker was approved, but the approval email could not be sent.";
      }
    }

    // ==================================================
    // APPLICATION COUNT
    // ==================================================

    const applicationsCount = await Application.countDocuments({
      seeker_id: seekerId,
    });

    return res.status(200).json({
      success: true,

      message:
        decision === "approved"
          ? emailWarning
            ? "Job seeker approved successfully, but the approval email could not be sent."
            : "Job seeker approved successfully."
          : "Job seeker rejected successfully.",

      email_sent: decision === "approved" ? emailSent : null,

      warning: emailWarning,

      data: await serializeSeeker(seeker, applicationsCount),
    });
  } catch (error) {
    console.error("UPDATE SEEKER APPROVAL ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to update approval status.",
    });
  }
};
