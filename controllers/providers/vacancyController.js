const Vacancy = require("../../models/providers/vacancySchema");
const Register = require("../../models/providers/registerSchema");
const Counter = require("../../models/providers/counterModel");

// ================= SERIAL VACANCY ID =================
const generateVacancyId = async () => {
  const counter = await Counter.findByIdAndUpdate(
    { _id: "vacancyId" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, returnDocument: "after" }
  );

  return `V-${counter.seq.toString().padStart(6, "0")}`;
};

// ================= PUBLIC FORMAT (SEEKER SAFE) =================
const toPublicVacancy = (v) => ({
  vacancyId: v.vacancyId,
  title: v.title,
  titleKana: v.titleKana,
  employmentType: v.employmentType,
  numberOfPeople: v.numberOfPeople,
  jobDescription: v.jobDescription,
  responsibilities: v.responsibilities,
  requiredSkills: v.requiredSkills,
  preferredSkills: v.preferredSkills,
  requiredEducation: v.requiredEducation,
  requiredExperience: v.requiredExperience,
  japaneseLevel: v.japaneseLevel,
  workLocation: v.workLocation,
  salaryMin: v.salaryMin,
  salaryMax: v.salaryMax,
  status: v.status,
  isPublished: v.isPublished, 
});

// ================= CREATE VACANCY =================
exports.createVacancy = async (req, res) => {
  try {
    const { registerId, companyName, title } = req.body;

    if (!registerId || !companyName || !title) {
      return res.status(400).json({
        message: "registerId, companyName, title required",
      });
    }

    const register = await Register.findOne({ registerId });
    if (!register) {
      return res.status(404).json({ message: "Register not found" });
    }

    const vacancyId = await generateVacancyId();

    const status =
      Object.values(req.body).every(
        (v) => v !== "" && v !== null && v !== undefined
      )
        ? "pending_review"
        : "draft";

    const vacancy = await Vacancy.create({
      ...req.body,
      vacancyId,
      status,
    });

    res.status(201).json({
      message: "Vacancy created",
      vacancy,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= APPROVE =================
exports.approveVacancy = async (req, res) => {
  const v = await Vacancy.findOneAndUpdate(
    { vacancyId: req.params.id },
    { status: "approved", reviewedAt: new Date() },
    { returnDocument: "after" }
  );

  res.json(v);
};

// ================= REJECT =================
exports.rejectVacancy = async (req, res) => {
  const v = await Vacancy.findOneAndUpdate(
    { vacancyId: req.params.id },
    { status: "rejected" },
    { returnDocument: "after" }
  );

  res.json(v);
};

// ================= PUBLISH (HIDES PRIVATE DATA) =================
exports.publishVacancy = async (req, res) => {
  const v = await Vacancy.findOneAndUpdate(
    { vacancyId: req.params.id },
    { status: "published", isPublished: true },
    { returnDocument: "after" }
  );

  if (!v) return res.status(404).json({ message: "Not found" });

  res.json({
    message: "Published successfully",
    vacancy: toPublicVacancy(v),
  });
};

// ================= CLOSE =================
exports.closeVacancy = async (req, res) => {
  const v = await Vacancy.findOneAndUpdate(
    { vacancyId: req.params.id },
    { status: "closed" },
    { returnDocument: "after" }
  );

  res.json(v);
};

// ================= GET ALL (ADMIN) =================
exports.getAllVacancies = async (req, res) => {
  const data = await Vacancy.find().sort({ createdAt: -1 });
  res.json({ count: data.length, data });
};

// ================= PUBLIC (SEEKER) =================
exports.getPublicVacancies = async (req, res) => {
  const data = await Vacancy.find({
    status: "published",
    isPublished: true,
  });

  res.json({
    count: data.length,
    vacancies: data.map(toPublicVacancy),
  });
};

// ================= GET BY VACANCY ID =================
exports.getVacancyById = async (req, res) => {
  const v = await Vacancy.findOne({ vacancyId: req.params.id });

  if (!v) return res.status(404).json({ message: "Not found" });

  res.json(v);
};

// ================= UPDATE =================
exports.updateVacancy = async (req, res) => {
  delete req.body.vacancyId;
  delete req.body.registerId;

  const v = await Vacancy.findOneAndUpdate(
    { vacancyId: req.params.id },
    req.body,
    { returnDocument: "after" }
  );

  res.json(v);
};

// ================= DELETE =================
exports.deleteVacancy = async (req, res) => {
  const v = await Vacancy.findOneAndDelete({
    vacancyId: req.params.id,
  });

  res.json({
    message: "Deleted",
    vacancyId: v?.vacancyId,
  });
};