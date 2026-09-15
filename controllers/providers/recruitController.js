const Recruit = require("../../models/providers/recruitSchema");

// ID generator
const generateRecruitId = () =>
  `R-${Math.floor(100000 + Math.random() * 900000)}`;

// CREATE
exports.createRecruit = async (req, res) => {
  try {
    const company_id = req.registerId;

    const recruit = await Recruit.create({
      ...req.body,
      recruitId: generateRecruitId(),
      company_id,
      status: "draft",
    });

    res.json(recruit);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET ALL
exports.getAllRecruits = async (req, res) => {
  const data = await Recruit.find();
  res.json(data);
};

// GET ONE
exports.getRecruitById = async (req, res) => {
  const data = await Recruit.findOne({
    recruitId: req.params.recruitId,
  });
  res.json(data);
};

// UPDATE
exports.updateRecruit = async (req, res) => {
  const data = await Recruit.findOneAndUpdate(
    { recruitId: req.params.recruitId },
    req.body,
    { new: true }
  );
  res.json(data);
};

// DELETE
exports.deleteRecruit = async (req, res) => {
  await Recruit.findOneAndDelete({
    recruitId: req.params.recruitId,
  });
  res.json({ message: "Deleted" });
};

// APPROVE
exports.approveRecruit = async (req, res) => {
  const data = await Recruit.findOneAndUpdate(
    { recruitId: req.params.recruitId },
    { status: "approved" },
    { new: true }
  );
  res.json(data);
};

// REJECT
exports.rejectRecruit = async (req, res) => {
  const data = await Recruit.findOneAndUpdate(
    { recruitId: req.params.recruitId },
    { status: "rejected" },
    { new: true }
  );
  res.json(data);
};