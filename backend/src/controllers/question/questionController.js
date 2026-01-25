import Question from "../../models/question/Question.js";
import TestCase from "../../models/question/TestCase.js";
import AuditLog from "../../models/admin/AuditLog.js";

export const getAllQuestions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      difficulty,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = { isActive: true };

    if (difficulty) {
      query.difficulty = difficulty;
    }

    if (search) {
      query.$text = { $search: search };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [questions, total] = await Promise.all([
      Question.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .select("-__v")
        .lean(),
      Question.countDocuments(query),
    ]);

    const questionIds = questions.map(q => q._id);
    const testCaseCounts = await TestCase.aggregate([
      { $match: { questionId: { $in: questionIds }, isActive: true } },
      {
        $group: {
          _id: "$questionId",
          total: { $sum: 1 },
          hidden: { $sum: { $cond: ["$isHidden", 1, 0] } },
        },
      },
    ]);

    const countMap = testCaseCounts.reduce((acc, curr) => {
      acc[curr._id.toString()] = { total: curr.total, hidden: curr.hidden };
      return acc;
    }, {});

    const questionsWithCounts = questions.map(q => ({
      ...q,
      testCases: countMap[q._id.toString()] || { total: 0, hidden: 0 },
    }));

    res.status(200).json({
      success: true,
      data: questionsWithCounts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[Get Questions Error]:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch questions",
    });
  }
};

export const getQuestionById = async (req, res) => {
  try {
    const question = await Question.findOne({
      _id: req.params.id,
      isActive: true,
    }).lean();

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    const testCases = await TestCase.find({
      questionId: question._id,
      isActive: true,
    }).sort({ order: 1 });

    res.status(200).json({
      success: true,
      data: {
        ...question,
        testCases: testCases.map(tc => tc.toSafeJSON()),
      },
    });
  } catch (error) {
    console.error("[Get Question Error]:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch question",
    });
  }
};

export const updateQuestion = async (req, res) => {
  try {
    const { title, description, difficulty, constraints, examples, tags } = req.body;

    const question = await Question.findOne({
      _id: req.params.id,
      isActive: true,
    });

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    if (title) question.title = title;
    if (description) question.description = description;
    if (difficulty) question.difficulty = difficulty;
    if (constraints !== undefined) question.constraints = constraints;
    if (examples) question.examples = examples;
    if (tags) question.tags = tags;

    question.updatedBy = req.admin._id;
    question.version += 1;

    await question.save();

    await AuditLog.log({
      adminId: req.admin._id,
      action: "UPDATE_QUESTION",
      resourceType: "Question",
      resourceId: question._id,
      details: { fields: Object.keys(req.body) },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.status(200).json({
      success: true,
      message: "Question updated successfully",
      data: question,
    });
  } catch (error) {
    console.error("[Update Question Error]:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to update question",
    });
  }
};

export const deleteQuestion = async (req, res) => {
  try {
    const question = await Question.findOne({
      _id: req.params.id,
      isActive: true,
    });

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    question.isActive = false;
    question.updatedBy = req.admin._id;
    await question.save();

    await TestCase.updateMany(
      { questionId: question._id },
      { isActive: false }
    );

    await AuditLog.log({
      adminId: req.admin._id,
      action: "DELETE_QUESTION",
      resourceType: "Question",
      resourceId: question._id,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.status(200).json({
      success: true,
      message: "Question deleted successfully",
    });
  } catch (error) {
    console.error("[Delete Question Error]:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to delete question",
    });
  }
};

export const createQuestion = async (req, res) => {
  try {
    const { title, description, difficulty, constraints, examples, tags } = req.body;

    if (!title || !description || !difficulty) {
      return res.status(400).json({
        success: false,
        message: "Title, description, and difficulty are required",
      });
    }

    const question = await Question.create({
      title,
      description,
      difficulty,
      constraints: constraints || "",
      examples: examples || [],
      tags: tags || [],
      createdBy: req.admin._id,
      updatedBy: req.admin._id,
    });

    await AuditLog.log({
      adminId: req.admin._id,
      action: "CREATE_QUESTION",
      resourceType: "Question",
      resourceId: question._id,
      details: { title },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.status(201).json({
      success: true,
      message: "Question created successfully",
      data: question,
    });
  } catch (error) {
    console.error("[Create Question Error]:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to create question",
    });
  }
};
