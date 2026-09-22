const fs = require("fs");
const path = require("path");

const TrainingCategory = require("../../models/training/trainingCategorySchema");

const TrainingTopic = require("../../models/training/trainingTopicSchema");

const TrainingFile = require("../../models/training/trainingFileSchema");

// ======================================================
// ESCAPE REGEX
// ======================================================

const escapeRegex = (value) => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// ======================================================
// PAGINATION
// ======================================================

const getPagination = (req) => {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);

  const limit = Math.min(
    Math.max(Number.parseInt(req.query.limit, 10) || 10, 1),
    100,
  );

  return {
    page,

    limit,

    skip: (page - 1) * limit,
  };
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

  viewEndpoint: `/staff/training/files/${file.fileId}/view`,

  createdAt: file.createdAt,

  updatedAt: file.updatedAt,
});

// ======================================================
// CATEGORY COUNTS
//
// Staff only sees ACTIVE topics/files.
// ======================================================

const getActiveCategoryCounts = async (categoryIds) => {
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

    status: "active",
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

        status: "active",
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
// GET CATEGORIES
//
// GET /api/staff/training/categories
// ======================================================

exports.getTrainingCategories = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req);

    const search = String(req.query.search || "").trim();

    const filter = {
      status: "active",
    };

    if (search) {
      filter.$or = [
        {
          name: {
            $regex: escapeRegex(search),
            $options: "i",
          },
        },

        {
          description: {
            $regex: escapeRegex(search),
            $options: "i",
          },
        },
      ];
    }

    const [categories, total] = await Promise.all([
      TrainingCategory.find(filter)
        .sort({
          sortOrder: 1,

          name: 1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      TrainingCategory.countDocuments(filter),
    ]);

    const categoryIds = categories.map((category) => category.categoryId);

    const counts = await getActiveCategoryCounts(categoryIds);

    const data = categories.map((category) =>
      serializeCategory(
        category,

        counts.get(category.categoryId),
      ),
    );

    const totalPages = Math.max(Math.ceil(total / limit), 1);

    return res.status(200).json({
      success: true,

      count: data.length,

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
    console.error("GET STAFF TRAINING CATEGORIES ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load training categories.",
    });
  }
};

// ======================================================
// GET TOPICS
//
// GET
// /api/staff/training/categories/:categoryId/topics
// ======================================================

exports.getTrainingTopics = async (req, res) => {
  try {
    const category = await TrainingCategory.findOne({
      categoryId: req.params.categoryId,

      status: "active",
    }).lean();

    if (!category) {
      return res.status(404).json({
        success: false,

        message: "Training category not found.",
      });
    }

    const search = String(req.query.search || "").trim();

    const filter = {
      categoryId: category.categoryId,

      status: "active",
    };

    if (search) {
      filter.$or = [
        {
          title: {
            $regex: escapeRegex(search),
            $options: "i",
          },
        },

        {
          description: {
            $regex: escapeRegex(search),
            $options: "i",
          },
        },
      ];
    }

    const topics = await TrainingTopic.find(filter)
      .sort({
        sortOrder: 1,

        title: 1,
      })
      .lean();

    const topicIds = topics.map((topic) => topic.topicId);

    const fileCounts =
      topicIds.length > 0
        ? await TrainingFile.aggregate([
            {
              $match: {
                topicId: {
                  $in: topicIds,
                },

                status: "active",
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

    return res.status(200).json({
      success: true,

      count: data.length,

      category: {
        categoryId: category.categoryId,

        name: category.name,

        slug: category.slug,
      },

      data,
    });
  } catch (error) {
    console.error("GET STAFF TRAINING TOPICS ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load training topics.",
    });
  }
};

// ======================================================
// GET TOPIC DETAILS
//
// GET /api/staff/training/topics/:topicId
// ======================================================

exports.getTrainingTopicById = async (req, res) => {
  try {
    const topic = await TrainingTopic.findOne({
      topicId: req.params.topicId,

      status: "active",
    }).lean();

    if (!topic) {
      return res.status(404).json({
        success: false,

        message: "Training topic not found.",
      });
    }

    const category = await TrainingCategory.findOne({
      categoryId: topic.categoryId,

      status: "active",
    }).lean();

    if (!category) {
      return res.status(404).json({
        success: false,

        message: "Training category not found.",
      });
    }

    const files = await TrainingFile.find({
      topicId: topic.topicId,

      status: "active",
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
    console.error("GET STAFF TRAINING TOPIC ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to load training topic.",
    });
  }
};

// ======================================================
// VIEW FILE
//
// GET /api/staff/training/files/:fileId/view
// ======================================================

exports.viewTrainingFile = async (req, res) => {
  try {
    const file = await TrainingFile.findOne({
      fileId: req.params.fileId,

      status: "active",
    });

    if (!file) {
      return res.status(404).json({
        success: false,

        message: "Training file not found.",
      });
    }

    // ==================================================
    // CONFIRM TOPIC IS ACTIVE
    // ==================================================

    const topic = await TrainingTopic.findOne({
      topicId: file.topicId,

      status: "active",
    }).lean();

    if (!topic) {
      return res.status(404).json({
        success: false,

        message: "Training topic not found.",
      });
    }

    // ==================================================
    // CONFIRM CATEGORY IS ACTIVE
    // ==================================================

    const category = await TrainingCategory.findOne({
      categoryId: topic.categoryId,

      status: "active",
    }).lean();

    if (!category) {
      return res.status(404).json({
        success: false,

        message: "Training category not found.",
      });
    }

    // ==================================================
    // FILE PATH
    // ==================================================

    const trainingDirectory = path.resolve(
      process.cwd(),

      "private_uploads",

      "training",
    );

    const absolutePath = path.resolve(
      process.cwd(),

      file.filePath,
    );

    const allowedPrefix = `${trainingDirectory}${path.sep}`;

    if (
      absolutePath !== trainingDirectory &&
      !absolutePath.startsWith(allowedPrefix)
    ) {
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
    console.error("VIEW STAFF TRAINING FILE ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to open training file.",
    });
  }
};
