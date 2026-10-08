const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

// ======================================================
// FOLDERS
// ======================================================

const GENERATED_RESUME_DIR = path.join(
  __dirname,
  "../private_uploads/generated-resumes",
);

const APPLICATION_RESUME_DIR = path.join(
  __dirname,
  "../private_uploads/application-resumes",
);

fs.mkdirSync(GENERATED_RESUME_DIR, {
  recursive: true,
});

fs.mkdirSync(APPLICATION_RESUME_DIR, {
  recursive: true,
});

// ======================================================
// RESUME AUDIENCES
//
// internal
// --------
// Professional resume used by:
//
// - Job Seeker
// - Admin
// - authorized Staff
//
// provider
// --------
// Provider-facing professional resume.
//
// Provider MAY see:
//
// - candidate name
// - nationality
// - visa information
// - Japanese level
// - desired job/location
// - skills
// - education, including school
// - employment experience, including previous company
//
// Provider MUST NOT receive:
//
// - email
// - phone
// - full/home address
// - exact current location
// - personal contact information
// - private documents
// ======================================================

const RESUME_AUDIENCES = {
  INTERNAL: "internal",

  PROVIDER: "provider",
};

// ======================================================
// HELPERS
// ======================================================

const formatDate = (date) => {
  if (!date) {
    return "-";
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }

  return parsedDate.toISOString().split("T")[0];
};

const setRegularFont = (doc) => {
  const customFont = process.env.RESUME_FONT_PATH;

  if (customFont && fs.existsSync(customFont)) {
    doc.font(customFont);

    return;
  }

  doc.font("Helvetica");
};

const setBoldFont = (doc) => {
  const customBoldFont = process.env.RESUME_BOLD_FONT_PATH;

  if (customBoldFont && fs.existsSync(customBoldFont)) {
    doc.font(customBoldFont);

    return;
  }

  doc.font("Helvetica-Bold");
};

const addSectionTitle = (doc, title) => {
  doc.moveDown(1);

  setBoldFont(doc);

  doc.fontSize(13).text(title);

  doc
    .moveTo(doc.x, doc.y + 3)
    .lineTo(540, doc.y + 3)
    .stroke();

  doc.moveDown(0.7);

  setRegularFont(doc);
};

const addLabelValue = (doc, label, value) => {
  setBoldFont(doc);

  doc.fontSize(10).text(`${label}: `, {
    continued: true,
  });

  setRegularFont(doc);

  doc.text(value || "-");
};

// ======================================================
// CREATE PDF DOCUMENT
// ======================================================

const createPdfDocument = () => {
  return new PDFDocument({
    size: "A4",

    margins: {
      top: 50,

      bottom: 50,

      left: 55,

      right: 55,
    },
  });
};

// ======================================================
// BUILD PROVIDER-SAFE PROFESSIONAL DATA
//
// Explicitly select only fields Provider is allowed to
// receive.
//
// Do NOT copy the complete Seeker object.
// ======================================================

const buildProviderProfessionalCandidate = (seeker) => ({
  name: seeker.name || null,

  nationality: seeker.nationality || null,

  visa_type: seeker.visa_type || null,

  visa_expiry_date: seeker.visa_expiry_date || null,

  japanese_level: seeker.japanese_level || null,

  desired_job: seeker.desired_job || null,

  desired_location: seeker.desired_location || null,

  skills: Array.isArray(seeker.skills) ? seeker.skills : [],

  education: Array.isArray(seeker.education)
    ? seeker.education.map((education) => ({
        enrollment_date: education.enrollment_date || null,

        graduation_date: education.graduation_date || null,

        school_type: education.school_type || null,

        school: education.school || null,

        major: education.major || null,
      }))
    : [],

  employment_history: Array.isArray(seeker.employment_history)
    ? seeker.employment_history.map((employment) => ({
        start_date: employment.start_date || null,

        end_date: employment.end_date || null,

        employment_type: employment.employment_type || null,

        company_name: employment.company_name || null,
      }))
    : [],
});

// ======================================================
// WRITE INTERNAL PROFESSIONAL RESUME
//
// Job Seeker / Admin / authorized Staff.
//
// This remains a professional resume only.
// It does not include:
//
// - email
// - phone
// - full address
// ======================================================

const writeInternalResumeContent = (doc, seeker) => {
  // --------------------------------------------------
  // TITLE
  // --------------------------------------------------

  setBoldFont(doc);

  doc.fontSize(22).text("Professional Resume", {
    align: "center",
  });

  doc.moveDown();

  // --------------------------------------------------
  // PROFESSIONAL INFORMATION
  // --------------------------------------------------

  addSectionTitle(doc, "Professional Information");

  addLabelValue(doc, "Name", seeker.name);

  addLabelValue(doc, "Nationality", seeker.nationality);

  addLabelValue(doc, "Visa Type", seeker.visa_type);

  addLabelValue(doc, "Visa Expiry", formatDate(seeker.visa_expiry_date));

  addLabelValue(doc, "Japanese Level", seeker.japanese_level);

  addLabelValue(doc, "Desired Job", seeker.desired_job);

  addLabelValue(doc, "Desired Location", seeker.desired_location);

  // --------------------------------------------------
  // SKILLS
  // --------------------------------------------------

  addSectionTitle(doc, "Skills");

  setRegularFont(doc);

  doc.fontSize(10).text(seeker.skills?.length ? seeker.skills.join(", ") : "-");

  // --------------------------------------------------
  // EDUCATION
  // --------------------------------------------------

  addSectionTitle(doc, "Education");

  if (seeker.education?.length) {
    seeker.education.forEach((education) => {
      setBoldFont(doc);

      doc.fontSize(11).text(education.school || "-");

      setRegularFont(doc);

      doc.fontSize(10).text(`School Type: ${education.school_type || "-"}`);

      doc.fontSize(10).text(`Major: ${education.major || "-"}`);

      doc
        .fontSize(10)
        .text(
          `${formatDate(education.enrollment_date)} - ${formatDate(
            education.graduation_date,
          )}`,
        );

      doc.moveDown(0.7);
    });
  } else {
    doc.text("-");
  }

  // --------------------------------------------------
  // EMPLOYMENT
  // --------------------------------------------------

  addSectionTitle(doc, "Employment History");

  if (seeker.employment_history?.length) {
    seeker.employment_history.forEach((employment) => {
      setBoldFont(doc);

      doc.fontSize(11).text(employment.company_name || "-");

      setRegularFont(doc);

      doc
        .fontSize(10)
        .text(`Employment Type: ${employment.employment_type || "-"}`);

      const endDate = employment.end_date
        ? formatDate(employment.end_date)
        : "Present";

      doc
        .fontSize(10)
        .text(`${formatDate(employment.start_date)} - ${endDate}`);

      doc.moveDown(0.7);
    });
  } else {
    doc.text("-");
  }
};

// ======================================================
// WRITE PROVIDER PROFESSIONAL RESUME
//
// Provider may see Candidate Name and professional
// information.
//
// Direct contact information remains excluded.
// ======================================================

const writeProviderResumeContent = (doc, seeker) => {
  const candidate = buildProviderProfessionalCandidate(seeker);

  // --------------------------------------------------
  // TITLE
  // --------------------------------------------------

  setBoldFont(doc);

  doc.fontSize(22).text("Professional Resume", {
    align: "center",
  });

  doc.moveDown(0.5);

  setRegularFont(doc);

  doc
    .fontSize(9)
    .text(
      "Candidate professional information provided through Vision Career.",
      {
        align: "center",
      },
    );

  doc.moveDown();

  // --------------------------------------------------
  // PROFESSIONAL INFORMATION
  // --------------------------------------------------

  addSectionTitle(doc, "Professional Information");

  addLabelValue(doc, "Name", candidate.name);

  addLabelValue(doc, "Nationality", candidate.nationality);

  addLabelValue(doc, "Visa Type", candidate.visa_type);

  addLabelValue(doc, "Visa Expiry", formatDate(candidate.visa_expiry_date));

  addLabelValue(doc, "Japanese Level", candidate.japanese_level);

  addLabelValue(doc, "Desired Job", candidate.desired_job);

  addLabelValue(doc, "Desired Location", candidate.desired_location);

  // --------------------------------------------------
  // SKILLS
  // --------------------------------------------------

  addSectionTitle(doc, "Skills");

  setRegularFont(doc);

  doc
    .fontSize(10)
    .text(candidate.skills.length ? candidate.skills.join(", ") : "-");

  // --------------------------------------------------
  // EDUCATION
  // --------------------------------------------------

  addSectionTitle(doc, "Education");

  if (candidate.education.length) {
    candidate.education.forEach((education) => {
      setBoldFont(doc);

      doc.fontSize(11).text(education.school || "-");

      setRegularFont(doc);

      doc.fontSize(10).text(`School Type: ${education.school_type || "-"}`);

      doc.fontSize(10).text(`Major: ${education.major || "-"}`);

      doc
        .fontSize(10)
        .text(
          `${formatDate(education.enrollment_date)} - ${formatDate(
            education.graduation_date,
          )}`,
        );

      doc.moveDown(0.7);
    });
  } else {
    doc.text("-");
  }

  // --------------------------------------------------
  // EMPLOYMENT HISTORY
  // --------------------------------------------------

  addSectionTitle(doc, "Employment History");

  if (candidate.employment_history.length) {
    candidate.employment_history.forEach((employment) => {
      setBoldFont(doc);

      doc.fontSize(11).text(employment.company_name || "-");

      setRegularFont(doc);

      doc
        .fontSize(10)
        .text(`Employment Type: ${employment.employment_type || "-"}`);

      const endDate = employment.end_date
        ? formatDate(employment.end_date)
        : "Present";

      doc
        .fontSize(10)
        .text(`${formatDate(employment.start_date)} - ${endDate}`);

      doc.moveDown(0.7);
    });
  } else {
    doc.text("-");
  }

  // --------------------------------------------------
  // COMMUNICATION NOTICE
  // --------------------------------------------------

  addSectionTitle(doc, "Communication Notice");

  doc
    .fontSize(9)
    .text(
      "Phone number, email address, full address, and other direct contact information are intentionally excluded. Please coordinate communication through Vision Career.",
    );
};

// ======================================================
// WRITE RESUME CONTENT BY AUDIENCE
// ======================================================

const writeResumeContent = (doc, seeker, options = {}) => {
  const { audience = RESUME_AUDIENCES.INTERNAL } = options;

  if (audience === RESUME_AUDIENCES.PROVIDER) {
    writeProviderResumeContent(doc, seeker);

    return;
  }

  writeInternalResumeContent(doc, seeker);
};

// ======================================================
// GENERATE PDF BUFFER
// ======================================================

const generateResumeBuffer = async (seeker, options = {}) => {
  return new Promise((resolve, reject) => {
    const doc = createPdfDocument();

    const chunks = [];

    doc.on("data", (chunk) => {
      chunks.push(chunk);
    });

    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    doc.on("error", reject);

    try {
      writeResumeContent(doc, seeker, options);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

// ======================================================
// GENERATE LOCAL PROFILE RESUME
//
// Existing profile-generated resume remains internal.
// ======================================================

const generateLocalProfileResume = async (seeker) => {
  const fileName = `${seeker.seeker_id}-${Date.now()}.pdf`;

  const relativePath = `generated-resumes/${fileName}`;

  const absolutePath = path.join(GENERATED_RESUME_DIR, fileName);

  await new Promise((resolve, reject) => {
    const doc = createPdfDocument();

    const stream = fs.createWriteStream(absolutePath);

    stream.on("finish", resolve);

    stream.on("error", reject);

    doc.on("error", reject);

    doc.pipe(stream);

    try {
      writeInternalResumeContent(doc, seeker);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });

  return {
    fileName,

    relativePath,

    absolutePath,
  };
};

// ======================================================
// GENERATE RESUME PDF
// ======================================================

const generateResumePdf = async (seeker, options = {}) => {
  const {
    type = "profile",

    applicationId = null,

    audience = RESUME_AUDIENCES.INTERNAL,
  } = options;

  // ====================================================
  // APPLICATION RESUME
  // ====================================================

  if (type === "application") {
    if (!applicationId) {
      throw new Error("applicationId is required for application resume.");
    }

    const providerSafe = audience === RESUME_AUDIENCES.PROVIDER;

    const fileName = providerSafe
      ? `${applicationId}-provider.pdf`
      : `${applicationId}.pdf`;

    const buffer = await generateResumeBuffer(seeker, {
      audience,
    });

    return {
      fileName,

      buffer,

      mimeType: "application/pdf",
    };
  }

  // ====================================================
  // PROFILE GENERATED RESUME
  // ====================================================

  return generateLocalProfileResume(seeker);
};

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  generateResumePdf,

  generateResumeBuffer,

  RESUME_AUDIENCES,

  GENERATED_RESUME_DIR,

  APPLICATION_RESUME_DIR,
};
