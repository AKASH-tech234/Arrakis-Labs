import TestCase from "../../models/question/TestCase.js";
import Question from "../../models/question/Question.js";
import AuditLog from "../../models/admin/AuditLog.js";
import { jsonToStdin, outputToStdout } from "../../utils/stdinConverter.js";

export const getTestCases = async (req, res) => {
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

    const testCases = await TestCase.find({
      questionId: req.params.id,
      isActive: true,
    }).sort({ order: 1 });

    res.status(200).json({
      success: true,
      data: testCases.map(tc => ({
        id: tc._id,
        stdin: tc.stdin,
        expectedStdout: tc.expectedStdout,
        isHidden: tc.isHidden,
        label: tc.label,
        timeLimit: tc.timeLimit,
        memoryLimit: tc.memoryLimit,
        order: tc.order,
        createdAt: tc.createdAt,
        updatedAt: tc.updatedAt,
      })),
    });
  } catch (error) {
    console.error("[Get Test Cases Error]:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch test cases",
    });
  }
};

export const createTestCase = async (req, res) => {
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

    const {
      input,
      expectedOutput,
      stdin,
      expectedStdout,
      isHidden = true,
      label,
      timeLimit = 2000,
      memoryLimit = 256,
    } = req.body;

    let finalStdin, finalExpectedStdout;

    if (stdin !== undefined) {
      
      finalStdin = stdin;
      finalExpectedStdout = expectedStdout;
    } else if (input !== undefined) {
      
      finalStdin = jsonToStdin(input);
      finalExpectedStdout = outputToStdout(expectedOutput);
    } else {
      return res.status(400).json({
        success: false,
        message: "Either 'stdin'/'expectedStdout' or 'input'/'expectedOutput' is required",
      });
    }

    if (finalStdin === undefined || finalStdin === null || finalExpectedStdout === undefined || finalExpectedStdout === null) {
      return res.status(400).json({
        success: false,
        message: "Test case input and expected output are required",
      });
    }

    const maxOrder = await TestCase.findOne({ questionId: req.params.id })
      .sort({ order: -1 })
      .select("order");

    const testCase = await TestCase.create({
      questionId: req.params.id,
      stdin: finalStdin,
      expectedStdout: finalExpectedStdout,
      isHidden,
      label: label || `Test Case ${(maxOrder?.order || 0) + 2}`,
      timeLimit,
      memoryLimit,
      order: (maxOrder?.order || 0) + 1,
    });

    await AuditLog.log({
      adminId: req.admin._id,
      action: "CREATE_TEST_CASE",
      resourceType: "TestCase",
      resourceId: testCase._id,
      details: {
        questionId: req.params.id,
        isHidden,
      },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.status(201).json({
      success: true,
      message: "Test case created successfully",
      data: {
        id: testCase._id,
        stdin: testCase.stdin,
        expectedStdout: testCase.expectedStdout,
        isHidden: testCase.isHidden,
        label: testCase.label,
        order: testCase.order,
      },
    });
  } catch (error) {
    console.error("[Create Test Case Error]:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to create test case",
    });
  }
};

export const updateTestCase = async (req, res) => {
  try {
    const testCase = await TestCase.findOne({
      _id: req.params.id,
      isActive: true,
    });

    if (!testCase) {
      return res.status(404).json({
        success: false,
        message: "Test case not found",
      });
    }

    const {
      input,
      expectedOutput,
      stdin,
      expectedStdout,
      isHidden,
      label,
      timeLimit,
      memoryLimit,
      order,
    } = req.body;

    if (stdin !== undefined) {
      testCase.stdin = stdin;
    } else if (input !== undefined) {
      testCase.stdin = jsonToStdin(input);
    }

    if (expectedStdout !== undefined) {
      testCase.expectedStdout = expectedStdout;
    } else if (expectedOutput !== undefined) {
      testCase.expectedStdout = outputToStdout(expectedOutput);
    }

    if (isHidden !== undefined) testCase.isHidden = isHidden;
    if (label !== undefined) testCase.label = label;
    if (timeLimit !== undefined) testCase.timeLimit = timeLimit;
    if (memoryLimit !== undefined) testCase.memoryLimit = memoryLimit;
    if (order !== undefined) testCase.order = order;

    await testCase.save();

    await AuditLog.log({
      adminId: req.admin._id,
      action: "UPDATE_TEST_CASE",
      resourceType: "TestCase",
      resourceId: testCase._id,
      details: { fields: Object.keys(req.body) },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.status(200).json({
      success: true,
      message: "Test case updated successfully",
      data: {
        id: testCase._id,
        stdin: testCase.stdin,
        expectedStdout: testCase.expectedStdout,
        isHidden: testCase.isHidden,
        label: testCase.label,
      },
    });
  } catch (error) {
    console.error("[Update Test Case Error]:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to update test case",
    });
  }
};

export const deleteTestCase = async (req, res) => {
  try {
    const testCase = await TestCase.findOne({
      _id: req.params.id,
      isActive: true,
    });

    if (!testCase) {
      return res.status(404).json({
        success: false,
        message: "Test case not found",
      });
    }

    testCase.isActive = false;
    await testCase.save();

    await AuditLog.log({
      adminId: req.admin._id,
      action: "DELETE_TEST_CASE",
      resourceType: "TestCase",
      resourceId: testCase._id,
      details: { questionId: testCase.questionId },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.status(200).json({
      success: true,
      message: "Test case deleted successfully",
    });
  } catch (error) {
    console.error("[Delete Test Case Error]:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to delete test case",
    });
  }
};

export const toggleHidden = async (req, res) => {
  try {
    const testCase = await TestCase.findOne({
      _id: req.params.id,
      isActive: true,
    });

    if (!testCase) {
      return res.status(404).json({
        success: false,
        message: "Test case not found",
      });
    }

    testCase.isHidden = !testCase.isHidden;
    await testCase.save();

    await AuditLog.log({
      adminId: req.admin._id,
      action: "TOGGLE_HIDDEN",
      resourceType: "TestCase",
      resourceId: testCase._id,
      details: { isHidden: testCase.isHidden },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.status(200).json({
      success: true,
      message: `Test case is now ${testCase.isHidden ? "hidden" : "visible"}`,
      data: { isHidden: testCase.isHidden },
    });
  } catch (error) {
    console.error("[Toggle Hidden Error]:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to toggle hidden status",
    });
  }
};
