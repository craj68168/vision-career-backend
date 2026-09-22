const fs = require("fs");

const path = require("path");

const TrainingCounter = require("../../models/training/trainingCounterSchema");

const TrainingCategory = require("../../models/training/trainingCategorySchema");

const TrainingTopic = require("../../models/training/trainingTopicSchema");

const TrainingFile = require("../../models/training/trainingFileSchema");

// ======================================================
// ID GENERATOR
// ======================================================

const nextTrainingId = async (counterName, prefix) => {
  const counter = await TrainingCounter.findByIdAndUpdate(
    {
      _id: counterName,
    },
    {
      $inc: {
        seq: 1,
      },
    },
    {
      new: true,
      upsert: true,
    },
  );

  return `${prefix}-${counter.seq.toString().padStart(6, "0")}`;
};

// ======================================================
// SLUG
// ======================================================

const slugify = (value) => {
  return String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

// ======================================================
// UNIQUE CATEGORY SLUG
// ======================================================

const generateCategorySlug = async (name, excludeCategoryId = null) => {
  const base = slugify(name) || "category";

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;

    const filter = {
      slug,
    };

    if (excludeCategoryId) {
      filter.categoryId = {
        $ne: excludeCategoryId,
      };
    }

    const exists = await TrainingCategory.exists(filter);

    if (!exists) {
      return slug;
    }
  }

  throw new Error("Unable to generate category slug.");
};

// ======================================================
// UNIQUE TOPIC SLUG
// ======================================================

const generateTopicSlug = async (categoryId, title, excludeTopicId = null) => {
  const base = slugify(title) || "topic";

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;

    const filter = {
      categoryId,

      slug,
    };

    if (excludeTopicId) {
      filter.topicId = {
        $ne: excludeTopicId,
      };
    }

    const exists = await TrainingTopic.exists(filter);

    if (!exists) {
      return slug;
    }
  }

  throw new Error("Unable to generate topic slug.");
};

// ======================================================
// ESCAPE SEARCH
// ======================================================

const escapeRegex = (value) => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// ======================================================
// PAGINATION
// ======================================================

const getPagination = (req) => {
  const page = Math.max(
    Number.parseInt(req.query.page, 10) || 1,

    1,
  );

  const limit = Math.min(
    Math.max(
      Number.parseInt(req.query.limit, 10) || 10,

      1,
    ),

    100,
  );

  return {
    page,

    limit,

    skip: (page - 1) * limit,
  };
};

// ======================================================
// FILE TYPE
// ======================================================

const getFileType = (mimeType) => {
  if (mimeType === "application/pdf") {
    return "pdf";
  }

  if (mimeType?.startsWith("video/")) {
    return "video";
  }

  if (mimeType?.startsWith("image/")) {
    return "image";
  }

  if (
    [
      "application/msword",

      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ].includes(mimeType)
  ) {
    return "doc";
  }

  if (
    [
      "application/vnd.ms-excel",

      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ].includes(mimeType)
  ) {
    return "excel";
  }

  if (
    [
      "application/vnd.ms-powerpoint",

      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ].includes(mimeType)
  ) {
    return "ppt";
  }

  return "other";
};

// ======================================================
// SAFE FILE DELETE
// ======================================================

const deletePhysicalFile = async (filePath) => {
  if (!filePath) {
    return;
  }

  const trainingDirectory = path.resolve(
    process.cwd(),
    "private_uploads",
    "training",
  );

  const absolutePath = path.resolve(process.cwd(), filePath);

  if (!absolutePath.startsWith(trainingDirectory)) {
    console.error(
      "TRAINING FILE PATH OUTSIDE ALLOWED DIRECTORY:",
      absolutePath,
    );

    return;
  }

  try {
    await fs.promises.unlink(absolutePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("DELETE TRAINING PHYSICAL FILE ERROR:", error);
    }
  }
};

// ======================================================
// SERIALIZERS
// ======================================================

const serializeCategory = (category, counts = {}) => ({
  categoryId: category.categoryId,

  name: category.name,

  slug: category.slug,

  description: category.description,

  sortOrder: category.sortOrder,

  status: category.status,

  topicsCount: counts.topicsCount || 0,

  filesCount: counts.filesCount || 0,

  createdAt: category.createdAt,

  updatedAt: category.updatedAt,
});

const serializeTopic = (topic, category, filesCount = 0) => ({
  topicId: topic.topicId,

  categoryId: topic.categoryId,

  categoryName: category?.name || null,

  categorySlug: category?.slug || null,

  title: topic.title,

  slug: topic.slug,

  description: topic.description,

  sortOrder: topic.sortOrder,

  status: topic.status,

  filesCount,

  createdAt: topic.createdAt,

  updatedAt: topic.updatedAt,
});

const serializeFile = (file) => ({
  fileId: file.fileId,

  topicId: file.topicId,

  fileTitle: file.fileTitle,

  fileName: file.originalFileName,

  fileType: file.fileType,

  mimeType: file.mimeType,

  fileSize: file.fileSize,

  externalUrl: file.externalUrl,

  sortOrder: file.sortOrder,

  status: file.status,

  uploadedByAdminId: file.uploadedByAdminId,

  viewEndpoint: `/admin/training/files/${file.fileId}/view`,

  createdAt: file.createdAt,

  updatedAt: file.updatedAt,
});

// ======================================================
// CATEGORY COUNTS
// ======================================================

const getCategoryCounts = async (categoryIds) => {
  const counts = new Map();

  categoryIds.forEach((categoryId) => {
    counts.set(categoryId, {
      topicsCount: 0,

      filesCount: 0,
    });
  });

  if (categoryIds.length === 0) {
    return counts;
  }

  const topics = await TrainingTopic.find({
    categoryId: {
      $in: categoryIds,
    },
  })
    .select("topicId categoryId")
    .lean();

  const topicCategoryMap = new Map();

  topics.forEach((topic) => {
    topicCategoryMap.set(topic.topicId, topic.categoryId);

    const current = counts.get(topic.categoryId);

    if (current) {
      current.topicsCount += 1;
    }
  });

  const topicIds = topics.map((topic) => topic.topicId);

  if (topicIds.length === 0) {
    return counts;
  }

  const fileCounts = await TrainingFile.aggregate([
    {
      $match: {
        topicId: {
          $in: topicIds,
        },
      },
    },

    {
      $group: {
        _id: "$topicId",

        count: {
          $sum: 1,
        },
      },
    },
  ]);

  fileCounts.forEach((item) => {
    const categoryId = topicCategoryMap.get(item._id);

    if (!categoryId) {
      return;
    }

    const current = counts.get(categoryId);

    if (current) {
      current.filesCount += item.count;
    }
  });

  return counts;
};

// ======================================================
// CATEGORY LIST
//
// GET /api/admin/training/categories
// ======================================================

exports.getTrainingCategories = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req);

    const search = String(req.query.search || "").trim();

    const status = String(req.query.status || "").trim();

    const sortOrder =
      String(
        req.query.sortOrder || req.query.sort_order || "ASC",
      ).toUpperCase() === "DESC"
        ? -1
        : 1;

    const sortFieldInput = String(
      req.query.sortBy || req.query.sort_by || "sortOrder",
    );

    const sortFields = {
      id: "categoryId",

      categoryId: "categoryId",

      name: "name",

      sort_order: "sortOrder",

      sortOrder: "sortOrder",

      status: "status",

      created_at: "createdAt",

      createdAt: "createdAt",

      updated_at: "updatedAt",

      updatedAt: "updatedAt",
    };

    const sortField = sortFields[sortFieldInput] || "sortOrder";

    const filter = {};

    if (search) {
      filter.name = {
        $regex: escapeRegex(search),

        $options: "i",
      };
    }

    if (["active", "inactive"].includes(status)) {
      filter.status = status;
    }

    const [categories, total] = await Promise.all([
      TrainingCategory.find(filter)
        .sort({
          [sortField]: sortOrder,

          createdAt: 1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      TrainingCategory.countDocuments(filter),
    ]);

    const categoryIds = categories.map((category) => category.categoryId);

    const counts = await getCategoryCounts(categoryIds);

    const data = categories.map((category) =>
      serializeCategory(
        category,

        counts.get(category.categoryId),
      ),
    );

    const totalPages = Math.max(
      Math.ceil(total / limit),

      1,
    );

    return res.status(200).json({
      success: true,

      message: "Training categories fetched successfully.",

      count: data.length,

      data,

      filters: {
        search,

        status,

        sortBy: sortFieldInput,

        sortOrder: sortOrder === 1 ? "ASC" : "DESC",
      },

      pagination: {
        page,

        limit,

        total,

        totalPages,

        hasNextPage: page < totalPages,

        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("GET TRAINING CATEGORIES ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load training categories.",
    });
  }
};

// ======================================================
// CREATE CATEGORY
//
// POST /api/admin/training/categories
// ======================================================

exports.createTrainingCategory = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();

    if (!name) {
      return res.status(400).json({
        success: false,

        message: "Category name is required.",
      });
    }

    if (name.length > 200) {
      return res.status(400).json({
        success: false,

        message: "Category name cannot exceed 200 characters.",
      });
    }

    const status = ["active", "inactive"].includes(req.body.status)
      ? req.body.status
      : "active";

    const description =
      req.body.description === null || req.body.description === undefined
        ? null
        : String(req.body.description).trim() || null;

    const sortOrder = Number(req.body.sortOrder ?? req.body.sort_order ?? 0);

    if (!Number.isFinite(sortOrder) || sortOrder < 0) {
      return res.status(400).json({
        success: false,

        message: "Invalid sort order.",
      });
    }

    const categoryId = await nextTrainingId("trainingCategoryId", "TC");

    const slug = await generateCategorySlug(name);

    const category = await TrainingCategory.create({
      categoryId,

      name,

      slug,

      description,

      sortOrder,

      status,

      createdByAdminId: req.admin?.adminId || null,

      updatedByAdminId: req.admin?.adminId || null,
    });

    return res.status(201).json({
      success: true,

      message: "Training category created successfully.",

      data: serializeCategory(category),
    });
  } catch (error) {
    console.error("CREATE TRAINING CATEGORY ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to create training category.",
    });
  }
};

// ======================================================
// UPDATE CATEGORY
//
// PATCH /api/admin/training/categories/:categoryId
// ======================================================

exports.updateTrainingCategory = async (req, res) => {
  try {
    const category = await TrainingCategory.findOne({
      categoryId: req.params.categoryId,
    });

    if (!category) {
      return res.status(404).json({
        success: false,

        message: "Training category not found.",
      });
    }

    if (req.body.name !== undefined) {
      const name = String(req.body.name || "").trim();

      if (!name) {
        return res.status(400).json({
          success: false,

          message: "Category name is required.",
        });
      }

      category.name = name;

      category.slug = await generateCategorySlug(
        name,

        category.categoryId,
      );
    }

    if (req.body.description !== undefined) {
      category.description =
        req.body.description === null
          ? null
          : String(req.body.description).trim() || null;
    }

    if (req.body.sortOrder !== undefined || req.body.sort_order !== undefined) {
      const sortOrder = Number(req.body.sortOrder ?? req.body.sort_order);

      if (!Number.isFinite(sortOrder) || sortOrder < 0) {
        return res.status(400).json({
          success: false,

          message: "Invalid sort order.",
        });
      }

      category.sortOrder = sortOrder;
    }

    if (req.body.status !== undefined) {
      if (!["active", "inactive"].includes(req.body.status)) {
        return res.status(400).json({
          success: false,

          message: "Invalid category status.",
        });
      }

      category.status = req.body.status;
    }

    category.updatedByAdminId = req.admin?.adminId || null;

    await category.save();

    const counts = await getCategoryCounts([category.categoryId]);

    return res.status(200).json({
      success: true,

      message: "Training category updated successfully.",

      data: serializeCategory(
        category,

        counts.get(category.categoryId),
      ),
    });
  } catch (error) {
    console.error("UPDATE TRAINING CATEGORY ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to update training category.",
    });
  }
};

// ======================================================
// DELETE CATEGORY
//
// DELETE /api/admin/training/categories/:categoryId
//
// Cascades:
// Category -> Topics -> Files
// ======================================================

exports.deleteTrainingCategory = async (req, res) => {
  try {
    const category = await TrainingCategory.findOne({
      categoryId: req.params.categoryId,
    });

    if (!category) {
      return res.status(404).json({
        success: false,

        message: "Training category not found.",
      });
    }

    const topics = await TrainingTopic.find({
      categoryId: category.categoryId,
    })
      .select("topicId")
      .lean();

    const topicIds = topics.map((topic) => topic.topicId);

    const files = topicIds.length
      ? await TrainingFile.find({
          topicId: {
            $in: topicIds,
          },
        })
      : [];

    for (const file of files) {
      await deletePhysicalFile(file.filePath);
    }

    if (topicIds.length) {
      await TrainingFile.deleteMany({
        topicId: {
          $in: topicIds,
        },
      });

      await TrainingTopic.deleteMany({
        categoryId: category.categoryId,
      });
    }

    await category.deleteOne();

    return res.status(200).json({
      success: true,

      message: "Training category deleted successfully.",

      data: {
        categoryId: category.categoryId,
      },
    });
  } catch (error) {
    console.error("DELETE TRAINING CATEGORY ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to delete training category.",
    });
  }
};

// ======================================================
// GET TOPICS
//
// GET
// /api/admin/training/categories/:categoryId/topics
// ======================================================

exports.getTrainingTopics = async (req, res) => {
  try {
    const category = await TrainingCategory.findOne({
      categoryId: req.params.categoryId,
    }).lean();

    if (!category) {
      return res.status(404).json({
        success: false,

        message: "Training category not found.",
      });
    }

    const { page, limit, skip } = getPagination(req);

    const search = String(req.query.search || "").trim();

    const status = String(req.query.status || "").trim();

    const sortOrder =
      String(
        req.query.sortOrder || req.query.sort_order || "ASC",
      ).toUpperCase() === "DESC"
        ? -1
        : 1;

    const sortFieldInput = String(
      req.query.sortBy || req.query.sort_by || "sortOrder",
    );

    const sortFields = {
      id: "topicId",

      topicId: "topicId",

      title: "title",

      sort_order: "sortOrder",

      sortOrder: "sortOrder",

      status: "status",

      created_at: "createdAt",

      createdAt: "createdAt",

      updated_at: "updatedAt",

      updatedAt: "updatedAt",
    };

    const sortField = sortFields[sortFieldInput] || "sortOrder";

    const filter = {
      categoryId: category.categoryId,
    };

    if (search) {
      filter.title = {
        $regex: escapeRegex(search),

        $options: "i",
      };
    }

    if (["active", "inactive"].includes(status)) {
      filter.status = status;
    }

    const [topics, total] = await Promise.all([
      TrainingTopic.find(filter)
        .sort({
          [sortField]: sortOrder,

          createdAt: 1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      TrainingTopic.countDocuments(filter),
    ]);

    const topicIds = topics.map((topic) => topic.topicId);

    const fileCounts = topicIds.length
      ? await TrainingFile.aggregate([
          {
            $match: {
              topicId: {
                $in: topicIds,
              },
            },
          },

          {
            $group: {
              _id: "$topicId",

              count: {
                $sum: 1,
              },
            },
          },
        ])
      : [];

    const fileCountMap = new Map(
      fileCounts.map((item) => [item._id, item.count]),
    );

    const data = topics.map((topic) =>
      serializeTopic(
        topic,

        category,

        fileCountMap.get(topic.topicId) || 0,
      ),
    );

    const totalPages = Math.max(
      Math.ceil(total / limit),

      1,
    );

    return res.status(200).json({
      success: true,

      message: "Training topics fetched successfully.",

      count: data.length,

      category: {
        categoryId: category.categoryId,

        name: category.name,

        slug: category.slug,
      },

      data,

      pagination: {
        page,

        limit,

        total,

        totalPages,

        hasNextPage: page < totalPages,

        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("GET TRAINING TOPICS ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load training topics.",
    });
  }
};

// ======================================================
// CREATE TOPIC
//
// POST
// /api/admin/training/categories/:categoryId/topics
// ======================================================

exports.createTrainingTopic = async (req, res) => {
  try {
    const category = await TrainingCategory.findOne({
      categoryId: req.params.categoryId,
    });

    if (!category) {
      return res.status(404).json({
        success: false,

        message: "Training category not found.",
      });
    }

    const title = String(req.body.title || "").trim();

    if (!title) {
      return res.status(400).json({
        success: false,

        message: "Topic title is required.",
      });
    }

    const description =
      req.body.description === null || req.body.description === undefined
        ? null
        : String(req.body.description).trim() || null;

    const sortOrder = Number(req.body.sortOrder ?? req.body.sort_order ?? 0);

    if (!Number.isFinite(sortOrder) || sortOrder < 0) {
      return res.status(400).json({
        success: false,

        message: "Invalid sort order.",
      });
    }

    const status = ["active", "inactive"].includes(req.body.status)
      ? req.body.status
      : "active";

    const topicId = await nextTrainingId("trainingTopicId", "TT");

    const slug = await generateTopicSlug(
      category.categoryId,

      title,
    );

    const topic = await TrainingTopic.create({
      topicId,

      categoryId: category.categoryId,

      title,

      slug,

      description,

      sortOrder,

      status,

      createdByAdminId: req.admin?.adminId || null,

      updatedByAdminId: req.admin?.adminId || null,
    });

    return res.status(201).json({
      success: true,

      message: "Training topic created successfully.",

      data: serializeTopic(
        topic,

        category,

        0,
      ),
    });
  } catch (error) {
    console.error("CREATE TRAINING TOPIC ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to create training topic.",
    });
  }
};

// ======================================================
// GET TOPIC DETAILS
//
// GET /api/admin/training/topics/:topicId
// ======================================================

exports.getTrainingTopicById = async (req, res) => {
  try {
    const topic = await TrainingTopic.findOne({
      topicId: req.params.topicId,
    }).lean();

    if (!topic) {
      return res.status(404).json({
        success: false,

        message: "Training topic not found.",
      });
    }

    const category = await TrainingCategory.findOne({
      categoryId: topic.categoryId,
    }).lean();

    const files = await TrainingFile.find({
      topicId: topic.topicId,
    })
      .sort({
        sortOrder: 1,

        createdAt: 1,
      })
      .lean();

    return res.status(200).json({
      success: true,

      data: {
        ...serializeTopic(
          topic,

          category,

          files.length,
        ),

        files: files.map(serializeFile),
      },
    });
  } catch (error) {
    console.error("GET TRAINING TOPIC ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load training topic.",
    });
  }
};

// ======================================================
// UPDATE TOPIC
//
// PATCH /api/admin/training/topics/:topicId
// ======================================================

exports.updateTrainingTopic = async (req, res) => {
  try {
    const topic = await TrainingTopic.findOne({
      topicId: req.params.topicId,
    });

    if (!topic) {
      return res.status(404).json({
        success: false,

        message: "Training topic not found.",
      });
    }

    if (req.body.title !== undefined) {
      const title = String(req.body.title || "").trim();

      if (!title) {
        return res.status(400).json({
          success: false,

          message: "Topic title is required.",
        });
      }

      topic.title = title;

      topic.slug = await generateTopicSlug(
        topic.categoryId,

        title,

        topic.topicId,
      );
    }

    if (req.body.description !== undefined) {
      topic.description =
        req.body.description === null
          ? null
          : String(req.body.description).trim() || null;
    }

    if (req.body.sortOrder !== undefined || req.body.sort_order !== undefined) {
      const sortOrder = Number(req.body.sortOrder ?? req.body.sort_order);

      if (!Number.isFinite(sortOrder) || sortOrder < 0) {
        return res.status(400).json({
          success: false,

          message: "Invalid sort order.",
        });
      }

      topic.sortOrder = sortOrder;
    }

    if (req.body.status !== undefined) {
      if (!["active", "inactive"].includes(req.body.status)) {
        return res.status(400).json({
          success: false,

          message: "Invalid topic status.",
        });
      }

      topic.status = req.body.status;
    }

    topic.updatedByAdminId = req.admin?.adminId || null;

    await topic.save();

    const category = await TrainingCategory.findOne({
      categoryId: topic.categoryId,
    }).lean();

    const filesCount = await TrainingFile.countDocuments({
      topicId: topic.topicId,
    });

    return res.status(200).json({
      success: true,

      message: "Training topic updated successfully.",

      data: serializeTopic(
        topic,

        category,

        filesCount,
      ),
    });
  } catch (error) {
    console.error("UPDATE TRAINING TOPIC ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to update training topic.",
    });
  }
};

// ======================================================
// DELETE TOPIC
//
// DELETE /api/admin/training/topics/:topicId
//
// Cascades:
// Topic -> Files
// ======================================================

exports.deleteTrainingTopic = async (req, res) => {
  try {
    const topic = await TrainingTopic.findOne({
      topicId: req.params.topicId,
    });

    if (!topic) {
      return res.status(404).json({
        success: false,

        message: "Training topic not found.",
      });
    }

    const files = await TrainingFile.find({
      topicId: topic.topicId,
    });

    for (const file of files) {
      await deletePhysicalFile(file.filePath);
    }

    await TrainingFile.deleteMany({
      topicId: topic.topicId,
    });

    await topic.deleteOne();

    return res.status(200).json({
      success: true,

      message: "Training topic deleted successfully.",

      data: {
        topicId: topic.topicId,

        categoryId: topic.categoryId,
      },
    });
  } catch (error) {
    console.error("DELETE TRAINING TOPIC ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to delete training topic.",
    });
  }
};

// ======================================================
// UPLOAD FILE
//
// POST
// /api/admin/training/topics/:topicId/files
// ======================================================

exports.uploadTrainingFile = async (req, res) => {
  try {
    const topic = await TrainingTopic.findOne({
      topicId: req.params.topicId,
    });

    if (!topic) {
      if (req.file) {
        await deletePhysicalFile(
          path.relative(process.cwd(), req.file.path).replace(/\\/g, "/"),
        );
      }

      return res.status(404).json({
        success: false,

        message: "Training topic not found.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,

        message: "Training file is required.",
      });
    }

    const fileTitle = String(
      req.body.fileTitle ?? req.body.file_title ?? "",
    ).trim();

    if (!fileTitle) {
      await deletePhysicalFile(
        path.relative(process.cwd(), req.file.path).replace(/\\/g, "/"),
      );

      return res.status(400).json({
        success: false,

        message: "File title is required.",
      });
    }

    const sortOrder = Number(req.body.sortOrder ?? req.body.sort_order ?? 0);

    if (!Number.isFinite(sortOrder) || sortOrder < 0) {
      await deletePhysicalFile(
        path.relative(process.cwd(), req.file.path).replace(/\\/g, "/"),
      );

      return res.status(400).json({
        success: false,

        message: "Invalid sort order.",
      });
    }

    const status = ["active", "inactive"].includes(req.body.status)
      ? req.body.status
      : "active";

    const fileId = await nextTrainingId("trainingFileId", "TF");

    const relativePath = path
      .relative(process.cwd(), req.file.path)
      .replace(/\\/g, "/");

    try {
      const trainingFile = await TrainingFile.create({
        fileId,

        topicId: topic.topicId,

        fileTitle,

        originalFileName: req.file.originalname,

        storedFileName: req.file.filename,

        filePath: relativePath,

        fileType: getFileType(req.file.mimetype),

        mimeType: req.file.mimetype,

        fileSize: req.file.size,

        sortOrder,

        status,

        uploadedByAdminId: req.admin?.adminId || null,
      });

      return res.status(201).json({
        success: true,

        message: "Training file uploaded successfully.",

        data: serializeFile(trainingFile),
      });
    } catch (error) {
      await deletePhysicalFile(relativePath);

      throw error;
    }
  } catch (error) {
    console.error("UPLOAD TRAINING FILE ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to upload training file.",
    });
  }
};

// ======================================================
// VIEW FILE
//
// GET /api/admin/training/files/:fileId/view
// ======================================================

exports.viewTrainingFile = async (req, res) => {
  try {
    const file = await TrainingFile.findOne({
      fileId: req.params.fileId,
    });

    if (!file) {
      return res.status(404).json({
        success: false,

        message: "Training file not found.",
      });
    }

    const trainingDirectory = path.resolve(
      process.cwd(),
      "private_uploads",
      "training",
    );

    const absolutePath = path.resolve(process.cwd(), file.filePath);

    if (!absolutePath.startsWith(trainingDirectory)) {
      return res.status(403).json({
        success: false,

        message: "Invalid training file path.",
      });
    }

    try {
      await fs.promises.access(absolutePath);
    } catch {
      return res.status(404).json({
        success: false,

        message: "Training file is missing from storage.",
      });
    }

    res.setHeader(
      "Content-Type",

      file.mimeType || "application/octet-stream",
    );

    res.setHeader(
      "Content-Disposition",

      `inline; filename*=UTF-8''${encodeURIComponent(file.originalFileName)}`,
    );

    return res.sendFile(absolutePath);
  } catch (error) {
    console.error("VIEW TRAINING FILE ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to open training file.",
    });
  }
};

// ======================================================
// DELETE FILE
//
// DELETE /api/admin/training/files/:fileId
// ======================================================

exports.deleteTrainingFile = async (req, res) => {
  try {
    const file = await TrainingFile.findOne({
      fileId: req.params.fileId,
    });

    if (!file) {
      return res.status(404).json({
        success: false,

        message: "Training file not found.",
      });
    }

    const responseData = serializeFile(file);

    await deletePhysicalFile(file.filePath);

    await file.deleteOne();

    return res.status(200).json({
      success: true,

      message: "Training file deleted successfully.",

      data: responseData,
    });
  } catch (error) {
    console.error("DELETE TRAINING FILE ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to delete training file.",
    });
  }
};
