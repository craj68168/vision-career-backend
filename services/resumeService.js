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
  const customFont =
    process.env.RESUME_FONT_PATH;

  if (
    customFont &&
    fs.existsSync(customFont)
  ) {
    doc.font(customFont);
    return;
  }

  doc.font("Helvetica");
};

const setBoldFont = (doc) => {
  const customBoldFont =
    process.env.RESUME_BOLD_FONT_PATH;

  if (
    customBoldFont &&
    fs.existsSync(customBoldFont)
  ) {
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

const addLabelValue = (
  doc,
  label,
  value,
) => {
  setBoldFont(doc);

  doc.fontSize(10).text(
    `${label}: `,
    {
      continued: true,
    },
  );

  setRegularFont(doc);

  doc.text(value || "-");
};

// ======================================================
// GENERATE RESUME PDF
// ======================================================

const generateResumePdf = async (
  seeker,
  options = {},
) => {
  const {
    type = "profile",
    applicationId = null,
  } = options;

  let fileName;
  let outputDirectory;
  let relativePath;

  if (type === "application") {
    if (!applicationId) {
      throw new Error(
        "applicationId is required for application resume.",
      );
    }

    fileName = `${applicationId}.pdf`;

    outputDirectory =
      APPLICATION_RESUME_DIR;

    relativePath =
      `application-resumes/${fileName}`;
  } else {
    fileName =
      `${seeker.seeker_id}-${Date.now()}.pdf`;

    outputDirectory =
      GENERATED_RESUME_DIR;

    relativePath =
      `generated-resumes/${fileName}`;
  }

  const absolutePath = path.join(
    outputDirectory,
    fileName,
  );

  // ==================================================
  // YOUR EXISTING PDFKIT CODE GOES HERE
  // ==================================================

  await new Promise(
    (resolve, reject) => {
      const doc =
        new PDFDocument({
          size: "A4",

          margins: {
            top: 50,
            bottom: 50,
            left: 55,
            right: 55,
          },
        });

      const stream =
        fs.createWriteStream(
          absolutePath,
        );

      stream.on("finish", resolve);
      stream.on("error", reject);
      doc.on("error", reject);

      doc.pipe(stream);

      // ----------------------------------------------
      // TITLE
      // ----------------------------------------------

      setBoldFont(doc);

      doc
        .fontSize(22)
        .text(
          "Professional Resume",
          {
            align: "center",
          },
        );

      doc.moveDown();

      // ----------------------------------------------
      // PROFESSIONAL INFORMATION
      // ----------------------------------------------

      addSectionTitle(
        doc,
        "Professional Information",
      );

      addLabelValue(
        doc,
        "Name",
        seeker.name,
      );

      addLabelValue(
        doc,
        "Nationality",
        seeker.nationality,
      );

      addLabelValue(
        doc,
        "Visa Type",
        seeker.visa_type,
      );

      addLabelValue(
        doc,
        "Visa Expiry",
        formatDate(
          seeker.visa_expiry_date,
        ),
      );

      addLabelValue(
        doc,
        "Japanese Level",
        seeker.japanese_level,
      );

      addLabelValue(
        doc,
        "Desired Job",
        seeker.desired_job,
      );

      addLabelValue(
        doc,
        "Desired Location",
        seeker.desired_location,
      );

      // ----------------------------------------------
      // SKILLS
      // ----------------------------------------------

      addSectionTitle(
        doc,
        "Skills",
      );

      setRegularFont(doc);

      doc
        .fontSize(10)
        .text(
          seeker.skills?.length
            ? seeker.skills.join(", ")
            : "-",
        );

      // ----------------------------------------------
      // EDUCATION
      // ----------------------------------------------

      addSectionTitle(
        doc,
        "Education",
      );

      if (
        seeker.education?.length
      ) {
        seeker.education.forEach(
          (education) => {
            setBoldFont(doc);

            doc
              .fontSize(11)
              .text(
                education.school ||
                  "-",
              );

            setRegularFont(doc);

            doc
              .fontSize(10)
              .text(
                `Major: ${
                  education.major ||
                  "-"
                }`,
              );

            doc
              .fontSize(10)
              .text(
                `${formatDate(
                  education.enrollment_date,
                )} - ${formatDate(
                  education.graduation_date,
                )}`,
              );

            doc.moveDown(0.7);
          },
        );
      } else {
        doc.text("-");
      }

      // ----------------------------------------------
      // EMPLOYMENT
      // ----------------------------------------------

      addSectionTitle(
        doc,
        "Employment History",
      );

      if (
        seeker.employment_history
          ?.length
      ) {
        seeker.employment_history.forEach(
          (employment) => {
            setBoldFont(doc);

            doc
              .fontSize(11)
              .text(
                employment.company_name ||
                  "-",
              );

            setRegularFont(doc);

            doc
              .fontSize(10)
              .text(
                `Employment Type: ${
                  employment.employment_type ||
                  "-"
                }`,
              );

            const endDate =
              employment.end_date
                ? formatDate(
                    employment.end_date,
                  )
                : "Present";

            doc
              .fontSize(10)
              .text(
                `${formatDate(
                  employment.start_date,
                )} - ${endDate}`,
              );

            doc.moveDown(0.7);
          },
        );
      } else {
        doc.text("-");
      }

      doc.end();
    },
  );

  return {
    fileName,
    relativePath,
    absolutePath,
  };
};

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  generateResumePdf,
  GENERATED_RESUME_DIR,
  APPLICATION_RESUME_DIR,
};