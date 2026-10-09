const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const { getPrivateFileObject } = require("./storageService");
const {
  getStorageKey,
  isStorageReference,
} = require("../utils/storageReference");

// ======================================================
// LEGACY LOCAL FOLDERS
//
// Kept only so older locally-generated resume records can
// still be read/cleaned by compatibility helpers.
// New generated resumes are uploaded to private storage.
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
// ======================================================

const RESUME_AUDIENCES = {
  INTERNAL: "internal",
  PROVIDER: "provider",
};

// ======================================================
// FONT DISCOVERY
//
// Set these in .env when possible:
// RESUME_FONT_PATH=/path/to/japanese-regular.ttf
// RESUME_BOLD_FONT_PATH=/path/to/japanese-bold.ttf
//
// If no Japanese-capable font is found, the PDF still
// renders in an English-label fallback while preserving
// the Japanese rirekisho layout.
// ======================================================

const SUPPORTED_FONT_EXTENSIONS = new Set([".ttf", ".otf"]);

const isSupportedFontPath = (value) => {
  if (!value || typeof value !== "string") {
    return false;
  }

  const extension = path.extname(value).toLowerCase();

  return SUPPORTED_FONT_EXTENSIONS.has(extension);
};

const firstExistingPath = (values) => {
  for (const value of values) {
    if (!value) {
      continue;
    }

    // PDFKit/fontkit needs an individual font face here.
    // Windows Japanese system fonts such as Meiryo are usually
    // .ttc collections. Passing a .ttc directly without selecting
    // a face causes: `this.font.createSubset is not a function`.
    // We therefore accept only standalone .ttf/.otf files.
    if (!isSupportedFontPath(value)) {
      continue;
    }

    if (fs.existsSync(value)) {
      return value;
    }
  }

  return null;
};

const REGULAR_FONT_PATH = firstExistingPath([
  process.env.RESUME_FONT_PATH,
  "/usr/share/fonts/opentype/noto/NotoSansCJKjp-Regular.otf",
  "/usr/share/fonts/opentype/noto/NotoSansJP-Regular.otf",
  "/usr/share/fonts/truetype/noto/NotoSansJP-Regular.ttf",
  "/usr/share/fonts/opentype/ipaexfont-gothic/ipaexg.ttf",
  "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf",
  "/usr/share/fonts/opentype/ipafont-gothic/ipagp.ttf",
]);

const BOLD_FONT_PATH = firstExistingPath([
  process.env.RESUME_BOLD_FONT_PATH,
  "/usr/share/fonts/opentype/noto/NotoSansCJKjp-Bold.otf",
  "/usr/share/fonts/opentype/noto/NotoSansJP-Bold.otf",
  "/usr/share/fonts/truetype/noto/NotoSansJP-Bold.ttf",
  "/usr/share/fonts/opentype/ipaexfont-gothic/ipaexg.ttf",
  "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf",
  "/usr/share/fonts/opentype/ipafont-gothic/ipagp.ttf",
  REGULAR_FONT_PATH,
]);

if (process.env.RESUME_FONT_PATH && !REGULAR_FONT_PATH) {
  console.warn(
    "RESUME_FONT_PATH was ignored. Use a standalone .ttf or .otf Japanese font; .ttc collections are not supported by this resume generator.",
  );
}

if (process.env.RESUME_BOLD_FONT_PATH && !BOLD_FONT_PATH) {
  console.warn(
    "RESUME_BOLD_FONT_PATH was ignored. Use a standalone .ttf or .otf Japanese font; .ttc collections are not supported by this resume generator.",
  );
}

const JAPANESE_FONT_AVAILABLE = Boolean(REGULAR_FONT_PATH);

const setRegularFont = (doc) => {
  if (REGULAR_FONT_PATH) {
    doc.font(REGULAR_FONT_PATH);
    return;
  }

  doc.font("Helvetica");
};

const setBoldFont = (doc) => {
  if (BOLD_FONT_PATH) {
    doc.font(BOLD_FONT_PATH);
    return;
  }

  doc.font("Helvetica-Bold");
};

// ======================================================
// LABELS
// ======================================================

const JP = {
  title: "履歴書",
  asOf: "現在",
  furigana: "ふりがな",
  name: "氏名",
  birthDate: "生年月日",
  age: "年齢",
  gender: "性別",
  address: "現住所",
  phone: "電話",
  email: "E-mail",
  nationality: "国籍",
  currentLocation: "現在地",
  visaType: "在留資格",
  visaExpiry: "在留期限",
  japaneseLevel: "日本語能力",
  desiredJob: "希望職種",
  desiredLocation: "希望勤務地",
  availableFrom: "就業可能日",
  skills: "スキル",
  education: "学歴",
  employment: "職歴",
  year: "年",
  month: "月",
  history: "学歴・職歴",
  additional: "資格・スキル・希望条件",
  notes: "その他",
  privacy: "連絡先情報はVision Careerを通じて管理されています。",
  photo: "写真",
};

const EN = {
  title: "Japanese-style Resume",
  asOf: "as of",
  furigana: "Name in Kana",
  name: "Name",
  birthDate: "Date of Birth",
  age: "Age",
  gender: "Gender",
  address: "Address",
  phone: "Phone",
  email: "E-mail",
  nationality: "Nationality",
  currentLocation: "Current Location",
  visaType: "Visa Type",
  visaExpiry: "Visa Expiry",
  japaneseLevel: "Japanese Level",
  desiredJob: "Desired Job",
  desiredLocation: "Desired Location",
  availableFrom: "Available From",
  skills: "Skills",
  education: "Education",
  employment: "Employment History",
  year: "Year",
  month: "Month",
  history: "Education / Employment History",
  additional: "Qualifications / Skills / Preferences",
  notes: "Other Information",
  privacy: "Direct contact details are managed through Vision Career.",
  photo: "Photo",
};

const labels = () => (JAPANESE_FONT_AVAILABLE ? JP : EN);

// ======================================================
// HELPERS
// ======================================================

const safeText = (value) => {
  if (value === undefined || value === null || value === "") {
    return "-";
  }

  return String(value);
};

const parseDate = (value) => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const formatDate = (value) => {
  const date = parseDate(value);

  if (!date) {
    return "-";
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  if (JAPANESE_FONT_AVAILABLE) {
    return `${year}年 ${Number(month)}月 ${Number(day)}日`;
  }

  return `${year}-${month}-${day}`;
};

const formatYearMonth = (value) => {
  const date = parseDate(value);

  if (!date) {
    return {
      year: "",
      month: "",
    };
  }

  return {
    year: String(date.getUTCFullYear()),
    month: String(date.getUTCMonth() + 1),
  };
};

const calculateAge = (value) => {
  const birthDate = parseDate(value);

  if (!birthDate) {
    return null;
  }

  const today = new Date();

  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();

  const monthDifference = today.getUTCMonth() - birthDate.getUTCMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getUTCDate() < birthDate.getUTCDate())
  ) {
    age -= 1;
  }

  return age >= 0 ? age : null;
};

const normalizeGender = (value) => {
  if (!value) {
    return "-";
  }

  const normalized = String(value).trim().toLowerCase();

  if (JAPANESE_FONT_AVAILABLE) {
    if (["male", "男性"].includes(normalized)) {
      return "男性";
    }

    if (["female", "女性"].includes(normalized)) {
      return "女性";
    }
  }

  return String(value);
};

const bodyToBuffer = async (body) => {
  if (!body) {
    return null;
  }

  if (typeof body.transformToByteArray === "function") {
    const bytes = await body.transformToByteArray();
    return Buffer.from(bytes);
  }

  if (typeof body[Symbol.asyncIterator] === "function") {
    const chunks = [];

    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  return null;
};

const isSupportedPdfImage = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8) {
    return false;
  }

  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;

  return isJpeg || isPng;
};

const loadProfilePhotoBuffer = async (storedPhoto) => {
  if (!storedPhoto) {
    return null;
  }

  try {
    if (isStorageReference(storedPhoto)) {
      const key = getStorageKey(storedPhoto);

      if (!key) {
        return null;
      }

      const object = await getPrivateFileObject(key);
      const buffer = await bodyToBuffer(object.Body);

      return isSupportedPdfImage(buffer) ? buffer : null;
    }

    const normalized = String(storedPhoto).replace(/\\/g, "/");
    const fileName = path.basename(normalized);

    const candidates = [
      path.join(process.cwd(), "uploads", fileName),
      path.join(process.cwd(), "private_uploads", fileName),
      path.join(process.cwd(), "private_uploads/profile-images", fileName),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        const buffer = await fs.promises.readFile(candidate);
        return isSupportedPdfImage(buffer) ? buffer : null;
      }
    }
  } catch (error) {
    console.error("Resume profile photo load error:", error);
  }

  return null;
};

const formatEducationText = (education) => {
  const parts = [];

  if (education?.school) {
    parts.push(education.school);
  }

  if (education?.major) {
    parts.push(education.major);
  }

  if (education?.school_type) {
    parts.push(`(${education.school_type})`);
  }

  return parts.length ? parts.join(" ") : "-";
};

const formatEmploymentText = (employment) => {
  const parts = [];

  if (employment?.company_name) {
    parts.push(employment.company_name);
  }

  if (employment?.employment_type) {
    parts.push(`(${employment.employment_type})`);
  }

  return parts.length ? parts.join(" ") : "-";
};

// ======================================================
// AUDIENCE-SAFE VIEW MODEL
// ======================================================

const buildResumeCandidate = (seeker, audience) => {
  const internal = audience === RESUME_AUDIENCES.INTERNAL;

  return {
    name: seeker.name || null,
    name_kana: seeker.name_kana || null,
    profile_photo: seeker.profile_photo || null,

    date_of_birth: internal ? seeker.date_of_birth || null : null,
    gender: internal ? seeker.gender || null : null,
    address: internal ? seeker.address || null : null,
    current_location: internal ? seeker.current_location || null : null,
    phone: internal ? seeker.phone || null : null,
    email: internal ? seeker.email || null : null,

    nationality: seeker.nationality || null,
    visa_type: seeker.visa_type || null,
    visa_expiry_date: seeker.visa_expiry_date || null,
    japanese_level: seeker.japanese_level || null,
    desired_job: seeker.desired_job || null,
    desired_location: seeker.desired_location || null,
    available_from: internal ? seeker.available_from || null : null,
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

    notes: internal ? seeker.notes || null : null,
  };
};

// ======================================================
// PDF DRAWING HELPERS
// ======================================================

const PAGE_LEFT = 32;
const PAGE_RIGHT = 563;
const PAGE_WIDTH = PAGE_RIGHT - PAGE_LEFT;
const PAGE_BOTTOM = 810;

const drawBorder = (doc, x, y, width, height, lineWidth = 0.8) => {
  doc.lineWidth(lineWidth).rect(x, y, width, height).stroke();
};

const drawCellText = (
  doc,
  text,
  x,
  y,
  width,
  height,
  {
    bold = false,
    fontSize = 8.5,
    align = "left",
    padding = 5,
    valign = "center",
  } = {},
) => {
  if (bold) {
    setBoldFont(doc);
  } else {
    setRegularFont(doc);
  }

  const value = safeText(text);

  const textHeight = doc.heightOfString(value, {
    width: Math.max(1, width - padding * 2),
    align,
    lineGap: 1,
  });

  const top =
    valign === "center"
      ? y + Math.max(padding, (height - textHeight) / 2)
      : y + padding;

  doc.fontSize(fontSize).text(value, x + padding, top, {
    width: Math.max(1, width - padding * 2),
    height: Math.max(1, height - padding * 2),
    align,
    lineGap: 1,
    ellipsis: true,
  });
};

const drawLabelValueRow = (
  doc,
  { x, y, width, height, label, value, labelWidth = 82, valueFontSize = 9 },
) => {
  drawBorder(doc, x, y, width, height);
  doc
    .moveTo(x + labelWidth, y)
    .lineTo(x + labelWidth, y + height)
    .stroke();

  drawCellText(doc, label, x, y, labelWidth, height, {
    bold: true,
    fontSize: 8,
    align: "center",
  });

  drawCellText(doc, value, x + labelWidth, y, width - labelWidth, height, {
    fontSize: valueFontSize,
  });
};

const drawPhoto = (doc, photoBuffer, x, y, width, height) => {
  drawBorder(doc, x, y, width, height);

  if (!photoBuffer) {
    drawCellText(doc, labels().photo, x, y, width, height, {
      fontSize: 9,
      align: "center",
    });
    return;
  }

  try {
    doc.image(photoBuffer, x + 3, y + 3, {
      fit: [width - 6, height - 6],
      align: "center",
      valign: "center",
    });
  } catch (error) {
    console.error("Resume photo rendering error:", error);
    drawCellText(doc, labels().photo, x, y, width, height, {
      fontSize: 9,
      align: "center",
    });
  }
};

const addNewHistoryPage = (doc, sectionTitle) => {
  doc.addPage({
    size: "A4",
    margins: {
      top: 32,
      bottom: 32,
      left: 32,
      right: 32,
    },
  });

  setBoldFont(doc);
  doc.fontSize(15).text(sectionTitle, PAGE_LEFT, 30, {
    width: PAGE_WIDTH,
  });

  return 58;
};

const drawHistoryHeader = (doc, y, title) => {
  const l = labels();
  const yearWidth = 48;
  const monthWidth = 38;
  const descriptionWidth = PAGE_WIDTH - yearWidth - monthWidth;
  const height = 26;

  drawBorder(doc, PAGE_LEFT, y, PAGE_WIDTH, height);
  doc
    .moveTo(PAGE_LEFT + yearWidth, y)
    .lineTo(PAGE_LEFT + yearWidth, y + height)
    .stroke();
  doc
    .moveTo(PAGE_LEFT + yearWidth + monthWidth, y)
    .lineTo(PAGE_LEFT + yearWidth + monthWidth, y + height)
    .stroke();

  drawCellText(doc, l.year, PAGE_LEFT, y, yearWidth, height, {
    bold: true,
    fontSize: 8,
    align: "center",
  });

  drawCellText(doc, l.month, PAGE_LEFT + yearWidth, y, monthWidth, height, {
    bold: true,
    fontSize: 8,
    align: "center",
  });

  drawCellText(
    doc,
    title,
    PAGE_LEFT + yearWidth + monthWidth,
    y,
    descriptionWidth,
    height,
    {
      bold: true,
      fontSize: 9,
      align: "center",
    },
  );

  return y + height;
};

const drawHistoryRow = (doc, y, dateValue, description) => {
  const yearWidth = 48;
  const monthWidth = 38;
  const descriptionWidth = PAGE_WIDTH - yearWidth - monthWidth;
  const rowHeight = 25;
  const { year, month } = formatYearMonth(dateValue);

  drawBorder(doc, PAGE_LEFT, y, PAGE_WIDTH, rowHeight);
  doc
    .moveTo(PAGE_LEFT + yearWidth, y)
    .lineTo(PAGE_LEFT + yearWidth, y + rowHeight)
    .stroke();
  doc
    .moveTo(PAGE_LEFT + yearWidth + monthWidth, y)
    .lineTo(PAGE_LEFT + yearWidth + monthWidth, y + rowHeight)
    .stroke();

  drawCellText(doc, year, PAGE_LEFT, y, yearWidth, rowHeight, {
    fontSize: 8.5,
    align: "center",
  });

  drawCellText(doc, month, PAGE_LEFT + yearWidth, y, monthWidth, rowHeight, {
    fontSize: 8.5,
    align: "center",
  });

  drawCellText(
    doc,
    description,
    PAGE_LEFT + yearWidth + monthWidth,
    y,
    descriptionWidth,
    rowHeight,
    {
      fontSize: 8.5,
    },
  );

  return y + rowHeight;
};

const drawHistorySection = (doc, startY, title, rows) => {
  let y = startY;

  if (y + 60 > PAGE_BOTTOM) {
    y = addNewHistoryPage(doc, labels().title);
  }

  y = drawHistoryHeader(doc, y, title);

  if (!rows.length) {
    y = drawHistoryRow(doc, y, null, "-");
    return y + 12;
  }

  for (const row of rows) {
    if (y + 30 > PAGE_BOTTOM) {
      y = addNewHistoryPage(doc, labels().title);
      y = drawHistoryHeader(doc, y, title);
    }

    y = drawHistoryRow(doc, y, row.date, row.text);
  }

  return y + 12;
};

const drawAdditionalInformation = (doc, startY, candidate, audience) => {
  const l = labels();
  let y = startY;

  if (y + 170 > PAGE_BOTTOM) {
    y = addNewHistoryPage(doc, l.title);
  }

  setBoldFont(doc);
  doc.fontSize(10).text(l.additional, PAGE_LEFT, y, {
    width: PAGE_WIDTH,
  });

  y += 18;

  const rows = [
    [l.nationality, candidate.nationality],
    [l.visaType, candidate.visa_type],
    [l.visaExpiry, formatDate(candidate.visa_expiry_date)],
    [l.japaneseLevel, candidate.japanese_level],
    [l.desiredJob, candidate.desired_job],
    [l.desiredLocation, candidate.desired_location],
    [l.skills, candidate.skills.length ? candidate.skills.join(", ") : "-"],
  ];

  if (audience === RESUME_AUDIENCES.INTERNAL) {
    rows.splice(6, 0, [l.availableFrom, formatDate(candidate.available_from)]);
  }

  for (const [label, value] of rows) {
    const height = label === l.skills ? 38 : 28;

    if (y + height > PAGE_BOTTOM) {
      y = addNewHistoryPage(doc, l.title);
    }

    drawLabelValueRow(doc, {
      x: PAGE_LEFT,
      y,
      width: PAGE_WIDTH,
      height,
      label,
      value,
      labelWidth: 110,
      valueFontSize: 8.5,
    });

    y += height;
  }

  if (candidate.notes) {
    y += 12;

    if (y + 70 > PAGE_BOTTOM) {
      y = addNewHistoryPage(doc, l.title);
    }

    setBoldFont(doc);
    doc.fontSize(10).text(l.notes, PAGE_LEFT, y, {
      width: PAGE_WIDTH,
    });

    y += 18;

    drawBorder(doc, PAGE_LEFT, y, PAGE_WIDTH, 65);
    drawCellText(doc, candidate.notes, PAGE_LEFT, y, PAGE_WIDTH, 65, {
      fontSize: 8.5,
      valign: "top",
    });

    y += 65;
  }

  if (audience === RESUME_AUDIENCES.PROVIDER) {
    y += 12;

    if (y + 45 > PAGE_BOTTOM) {
      y = addNewHistoryPage(doc, l.title);
    }

    drawBorder(doc, PAGE_LEFT, y, PAGE_WIDTH, 38);
    drawCellText(doc, l.privacy, PAGE_LEFT, y, PAGE_WIDTH, 38, {
      fontSize: 8,
      align: "center",
    });
  }
};

// ======================================================
// JAPANESE-STYLE RIREKISHO
// ======================================================

const writeRirekisho = ({ doc, candidate, audience, photoBuffer }) => {
  const l = labels();
  const internal = audience === RESUME_AUDIENCES.INTERNAL;

  const infoX = PAGE_LEFT;
  const infoWidth = 416;
  const photoX = 460;
  const photoWidth = 103;
  const photoHeight = 128;

  setBoldFont(doc);
  doc.fontSize(22).text(l.title, PAGE_LEFT, 28, {
    width: 150,
  });

  setRegularFont(doc);
  doc.fontSize(8.5).text(`${formatDate(new Date())} ${l.asOf}`, 230, 38, {
    width: 210,
    align: "right",
  });

  drawPhoto(doc, photoBuffer, photoX, 28, photoWidth, photoHeight);

  let y = 58;

  drawLabelValueRow(doc, {
    x: infoX,
    y,
    width: infoWidth,
    height: 30,
    label: l.furigana,
    value: candidate.name_kana,
  });

  y += 30;

  drawLabelValueRow(doc, {
    x: infoX,
    y,
    width: infoWidth,
    height: 48,
    label: l.name,
    value: candidate.name,
    valueFontSize: 15,
  });

  y += 48;

  if (internal) {
    const rowHeight = 34;
    const dobWidth = 250;
    const genderWidth = infoWidth - dobWidth;

    drawBorder(doc, infoX, y, infoWidth, rowHeight);
    doc
      .moveTo(infoX + dobWidth, y)
      .lineTo(infoX + dobWidth, y + rowHeight)
      .stroke();

    const age = calculateAge(candidate.date_of_birth);
    const birthValue = candidate.date_of_birth
      ? `${formatDate(candidate.date_of_birth)} / ${l.age}: ${age ?? "-"}`
      : "-";

    drawCellText(
      doc,
      `${l.birthDate}: ${birthValue}`,
      infoX,
      y,
      dobWidth,
      rowHeight,
      {
        fontSize: 8.5,
      },
    );

    drawCellText(
      doc,
      `${l.gender}: ${normalizeGender(candidate.gender)}`,
      infoX + dobWidth,
      y,
      genderWidth,
      rowHeight,
      {
        fontSize: 8.5,
      },
    );

    y += rowHeight;

    drawLabelValueRow(doc, {
      x: infoX,
      y,
      width: PAGE_WIDTH,
      height: 40,
      label: l.address,
      value: candidate.address,
      labelWidth: 82,
    });

    y += 40;

    const contactHeight = 38;
    const half = PAGE_WIDTH / 2;

    drawBorder(doc, PAGE_LEFT, y, PAGE_WIDTH, contactHeight);
    doc
      .moveTo(PAGE_LEFT + half, y)
      .lineTo(PAGE_LEFT + half, y + contactHeight)
      .stroke();

    drawCellText(
      doc,
      `${l.phone}: ${safeText(candidate.phone)}`,
      PAGE_LEFT,
      y,
      half,
      contactHeight,
      {
        fontSize: 8.5,
      },
    );

    drawCellText(
      doc,
      `${l.email}: ${safeText(candidate.email)}`,
      PAGE_LEFT + half,
      y,
      half,
      contactHeight,
      {
        fontSize: 8.5,
      },
    );

    y += contactHeight + 18;
  } else {
    drawLabelValueRow(doc, {
      x: infoX,
      y,
      width: infoWidth,
      height: 34,
      label: l.nationality,
      value: candidate.nationality,
    });

    y += 34;

    drawLabelValueRow(doc, {
      x: infoX,
      y,
      width: PAGE_WIDTH,
      height: 38,
      label: l.privacy,
      value: "Vision Career",
      labelWidth: 260,
    });

    y += 56;
  }

  const educationRows = [];

  for (const education of candidate.education) {
    if (education.enrollment_date) {
      educationRows.push({
        date: education.enrollment_date,
        text: JAPANESE_FONT_AVAILABLE
          ? `${formatEducationText(education)} 入学`
          : `${formatEducationText(education)} - Enrolled`,
      });
    }

    if (education.graduation_date) {
      educationRows.push({
        date: education.graduation_date,
        text: JAPANESE_FONT_AVAILABLE
          ? `${formatEducationText(education)} 卒業`
          : `${formatEducationText(education)} - Graduated`,
      });
    }

    if (!education.enrollment_date && !education.graduation_date) {
      educationRows.push({
        date: null,
        text: formatEducationText(education),
      });
    }
  }

  y = drawHistorySection(doc, y, l.education, educationRows);

  const employmentRows = [];

  for (const employment of candidate.employment_history) {
    if (employment.start_date) {
      employmentRows.push({
        date: employment.start_date,
        text: JAPANESE_FONT_AVAILABLE
          ? `${formatEmploymentText(employment)} 入社`
          : `${formatEmploymentText(employment)} - Started`,
      });
    }

    if (employment.end_date) {
      employmentRows.push({
        date: employment.end_date,
        text: JAPANESE_FONT_AVAILABLE
          ? `${formatEmploymentText(employment)} 退職`
          : `${formatEmploymentText(employment)} - Ended`,
      });
    } else if (employment.start_date) {
      employmentRows.push({
        date: null,
        text: JAPANESE_FONT_AVAILABLE ? "現在に至る" : "Present",
      });
    }

    if (!employment.start_date && !employment.end_date) {
      employmentRows.push({
        date: null,
        text: formatEmploymentText(employment),
      });
    }
  }

  y = drawHistorySection(doc, y, l.employment, employmentRows);

  drawAdditionalInformation(doc, y, candidate, audience);
};

// ======================================================
// CREATE PDF DOCUMENT
// ======================================================

const createPdfDocument = () => {
  return new PDFDocument({
    size: "A4",
    margins: {
      top: 32,
      bottom: 32,
      left: 32,
      right: 32,
    },
    info: {
      Title: "Vision Career Japanese-style Resume",
      Author: "Vision Career",
    },
  });
};

// ======================================================
// GENERATE PDF BUFFER
// ======================================================

const generateResumeBuffer = async (seeker, options = {}) => {
  const { audience = RESUME_AUDIENCES.INTERNAL } = options;

  const candidate = buildResumeCandidate(seeker, audience);
  const photoBuffer = await loadProfilePhotoBuffer(candidate.profile_photo);

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
      writeRirekisho({
        doc,
        candidate,
        audience,
        photoBuffer,
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

// ======================================================
// GENERATE RESUME PDF
//
// Both profile and application resumes now return a
// Buffer. Controllers decide where the PDF is stored.
// ======================================================

const generateResumePdf = async (seeker, options = {}) => {
  const {
    type = "profile",
    applicationId = null,
    audience = RESUME_AUDIENCES.INTERNAL,
  } = options;

  if (type === "application" && !applicationId) {
    throw new Error("applicationId is required for application resume.");
  }

  const buffer = await generateResumeBuffer(seeker, {
    audience,
  });

  const fileName =
    type === "application"
      ? `${applicationId}${
          audience === RESUME_AUDIENCES.PROVIDER ? "-provider" : ""
        }.pdf`
      : `${seeker.seeker_id}-rirekisho.pdf`;

  return {
    fileName,
    buffer,
    mimeType: "application/pdf",
  };
};

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  generateResumePdf,
  generateResumeBuffer,
  RESUME_AUDIENCES,
  GENERATED_RESUME_DIR,
  APPLICATION_RESUME_DIR,
  JAPANESE_FONT_AVAILABLE,
};
