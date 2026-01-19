import axios from "axios";
import mongoose from "mongoose";
import Question from "../models/Question.js";
import TestCase from "../models/TestCase.js";
import Submission from "../models/Submission.js";
import { compareOutputs } from "../utils/stdinConverter.js";
import {
  getAIFeedback,
  buildUserHistorySummary,
} from "../services/aiService.js";

const PISTON_URL = process.env.PISTON_URL || "https://emkc.org/api/v2/piston";
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // ms
const MAX_CODE_SIZE = 65536; // 64KB
const MAX_STDIN_SIZE = 1024 * 1024; // 1MB stdin limit

// Language mapping for Piston
const LANGUAGE_MAP = {
  javascript: { language: "javascript", version: "18.15.0" },
  python: { language: "python", version: "3.10.0" },
  java: { language: "java", version: "15.0.2" },
  cpp: { language: "cpp", version: "10.2.0" },
  c: { language: "c", version: "10.2.0" },
  typescript: { language: "typescript", version: "5.0.3" },
  go: { language: "go", version: "1.16.2" },
  rust: { language: "rust", version: "1.68.2" },
};

// Helper: sleep for retry backoff
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Validate ObjectId to prevent injection
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Execute code with Piston API
 * Includes retry logic for transient failures and proper timeout handling
 * @param {string} code - Source code
 * @param {string} language - Programming language
 * @param {string} stdin - Standard input
 * @param {number} timeLimit - Time limit in ms
 * @returns {Promise<{ stdout: string, stderr: string, exitCode: number, timedOut: boolean, runtimeError: boolean }>}
 */
async function executePiston(code, language, stdin, timeLimit = 2000) {
  const langConfig = LANGUAGE_MAP[language.toLowerCase()];

  if (!langConfig) {
    throw new Error(`Unsupported language: ${language}`);
  }

  // Validate input sizes
  if (code.length > MAX_CODE_SIZE) {
    throw new Error("Code size exceeds maximum limit (64KB)");
  }
  if (stdin && stdin.length > MAX_STDIN_SIZE) {
    throw new Error("Input size exceeds maximum limit (1MB)");
  }

  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(
        `${PISTON_URL}/execute`,
        {
          language: langConfig.language,
          version: langConfig.version,
          files: [{ content: code }],
          stdin: stdin || "",
          run_timeout: timeLimit,
          compile_timeout: 10000,
          compile_memory_limit: 256 * 1024 * 1024,
          run_memory_limit: 256 * 1024 * 1024,
        },
        {
          timeout: Math.max(timeLimit + 10000, 15000), // At least 15s for network
          validateStatus: (status) => status < 500, // Retry on 5xx
        },
      );

      if (response.status >= 400) {
        throw new Error(`Piston API error: ${response.status}`);
      }

      const { run, compile } = response.data;

      // Check for compile error
      if (compile && compile.stderr) {
        return {
          stdout: "",
          stderr: compile.stderr.slice(0, 10000), // Limit error output
          exitCode: compile.code || 1,
          timedOut: false,
          compileError: true,
          runtimeError: false,
        };
      }

      // Check for runtime error (non-zero exit, has stderr, signal)
      const hasRuntimeError =
        (run?.code !== 0 && run?.code !== undefined) ||
        run?.signal === "SIGSEGV" ||
        run?.signal === "SIGABRT";

      return {
        stdout: (run?.stdout || "").slice(0, 100000), // Limit output to 100KB
        stderr: (run?.stderr || "").slice(0, 10000),
        exitCode: run?.code ?? 0,
        timedOut: run?.signal === "SIGKILL",
        compileError: false,
        runtimeError: hasRuntimeError && !run?.signal?.includes("KILL"),
      };
    } catch (error) {
      lastError = error;

      // Don't retry on timeout (user code issue) or validation errors
      if (error.code === "ECONNABORTED" || error.message.includes("exceeds")) {
        break;
      }

      // Retry on network/server errors
      if (attempt < MAX_RETRIES) {
        console.warn(`[Piston] Attempt ${attempt + 1} failed, retrying...`);
        await sleep(RETRY_DELAY * (attempt + 1));
        continue;
      }
    }
  }

  // All retries failed
  console.error("[Piston] All retries failed:", lastError?.message);
  throw new Error("Code execution service temporarily unavailable");
}

/**
 * RUN CODE - Execute with visible test cases only
 * User can see input/expected for debugging
 * POST /api/run
 */
export const runCode = async (req, res) => {
  try {
    const { questionId, code, language } = req.body;

    // Input validation
    if (!questionId || !code || !language) {
      return res.status(400).json({
        success: false,
        message: "questionId, code, and language are required",
      });
    }

    // Validate ObjectId format (prevent NoSQL injection)
    if (!isValidObjectId(questionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid question ID format",
      });
    }

    // Validate language
    if (!LANGUAGE_MAP[language.toLowerCase()]) {
      return res.status(400).json({
        success: false,
        message: `Unsupported language. Supported: ${Object.keys(LANGUAGE_MAP).join(", ")}`,
      });
    }

    // Validate code size
    if (typeof code !== "string" || code.length > MAX_CODE_SIZE) {
      return res.status(400).json({
        success: false,
        message: "Invalid code or code exceeds maximum size (64KB)",
      });
    }

    // Get question
    const question = await Question.findOne({
      _id: questionId,
      isActive: true,
    });

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    // Get VISIBLE test cases only for "Run"
    const visibleTestCases = await TestCase.find({
      questionId,
      isActive: true,
      isHidden: false,
    }).sort({ order: 1 });

    if (visibleTestCases.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No visible test cases available for this question",
      });
    }

    // Execute each visible test case
    const results = [];

    for (const tc of visibleTestCases) {
      try {
        const execution = await executePiston(
          code,
          language,
          tc.stdin,
          tc.timeLimit,
        );

        const passed =
          !execution.compileError &&
          !execution.timedOut &&
          execution.exitCode === 0 &&
          compareOutputs(execution.stdout, tc.expectedStdout);

        results.push({
          label: tc.label,
          stdin: tc.stdin, // Visible - user can see
          expectedStdout: tc.expectedStdout, // Visible - user can see
          actualStdout: execution.stdout.trim(),
          stderr: execution.stderr,
          passed,
          timedOut: execution.timedOut,
          compileError: execution.compileError,
        });

        // Stop on compile error
        if (execution.compileError) {
          break;
        }
      } catch (error) {
        // Check if it's a service unavailable error
        const isServiceError = error.message.includes("unavailable");

        results.push({
          label: tc.label,
          stdin: tc.stdin,
          expectedStdout: tc.expectedStdout,
          actualStdout: "",
          stderr: isServiceError
            ? "Execution service temporarily unavailable"
            : error.message,
          passed: false,
          error: true,
          serviceError: isServiceError,
        });

        // If service is down, stop trying more test cases
        if (isServiceError) {
          break;
        }
      }
    }

    const passedCount = results.filter((r) => r.passed).length;
    const hasServiceError = results.some((r) => r.serviceError);

    res.status(hasServiceError ? 503 : 200).json({
      success: !hasServiceError,
      message: hasServiceError
        ? "Code execution service temporarily unavailable"
        : undefined,
      data: {
        results,
        passedCount,
        totalCount: results.length,
        allPassed: passedCount === results.length && !hasServiceError,
      },
    });
  } catch (error) {
    console.error("[Run Code Error]:", error.message);

    // Distinguish between different error types
    if (error.message.includes("unavailable")) {
      return res.status(503).json({
        success: false,
        message:
          "Code execution service temporarily unavailable. Please try again later.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to execute code",
    });
  }
};

/**
 * SUBMIT CODE - Execute with ALL test cases (including hidden)
 * User CANNOT see hidden test case details
 * POST /api/submit
 */
export const submitCode = async (req, res) => {
  try {
    const { questionId, code, language } = req.body;
    const userId = req.user?._id; // From auth middleware

    // Input validation
    if (!questionId || !code || !language) {
      return res.status(400).json({
        success: false,
        message: "questionId, code, and language are required",
      });
    }

    // Validate ObjectId format (prevent NoSQL injection)
    if (!isValidObjectId(questionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid question ID format",
      });
    }

    // Validate language
    if (!LANGUAGE_MAP[language.toLowerCase()]) {
      return res.status(400).json({
        success: false,
        message: `Unsupported language. Supported: ${Object.keys(LANGUAGE_MAP).join(", ")}`,
      });
    }

    // Validate code size
    if (typeof code !== "string" || code.length > MAX_CODE_SIZE) {
      return res.status(400).json({
        success: false,
        message: "Invalid code or code exceeds maximum size (64KB)",
      });
    }

    // Get question
    const question = await Question.findOne({
      _id: questionId,
      isActive: true,
    });

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    // Get ALL test cases (hidden + visible)
    const allTestCases = await TestCase.find({
      questionId,
      isActive: true,
    }).sort({ order: 1 });

    if (allTestCases.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No test cases available for this question",
      });
    }

    // Execute each test case
    const results = [];
    let compileErrorOccurred = false;

    for (const tc of allTestCases) {
      try {
        const execution = await executePiston(
          code,
          language,
          tc.stdin,
          tc.timeLimit,
        );

        const passed =
          !execution.compileError &&
          !execution.timedOut &&
          execution.exitCode === 0 &&
          compareOutputs(execution.stdout, tc.expectedStdout);

        // For hidden test cases, only show pass/fail - no details
        if (tc.isHidden) {
          results.push({
            label: tc.label,
            isHidden: true,
            passed,
            timedOut: execution.timedOut,
            compileError: execution.compileError,
            // NO stdin, expectedStdout, or actualStdout for hidden
          });
        } else {
          results.push({
            label: tc.label,
            isHidden: false,
            stdin: tc.stdin,
            expectedStdout: tc.expectedStdout,
            actualStdout: execution.stdout.trim(),
            stderr: execution.stderr,
            passed,
            timedOut: execution.timedOut,
            compileError: execution.compileError,
          });
        }

        // Stop on compile error
        if (execution.compileError) {
          compileErrorOccurred = true;
          break;
        }
      } catch (error) {
        // Check for service errors
        const isServiceError = error.message.includes("unavailable");

        results.push({
          label: tc.label,
          isHidden: tc.isHidden,
          passed: false,
          error: true,
          serviceError: isServiceError,
          // Only show error for visible tests
          ...(tc.isHidden
            ? {}
            : {
                stderr: isServiceError
                  ? "Execution service temporarily unavailable"
                  : error.message,
              }),
        });

        // If service is down, mark submission and stop
        if (isServiceError) {
          break;
        }
      }
    }

    const passedCount = results.filter((r) => r.passed).length;
    const hasServiceError = results.some((r) => r.serviceError);
    const allPassed = passedCount === allTestCases.length && !hasServiceError;

    // Determine status
    let status = "wrong_answer";
    if (hasServiceError) {
      status = "runtime_error"; // Use this for service issues
    } else if (compileErrorOccurred) {
      status = "compile_error";
    } else if (results.some((r) => r.timedOut)) {
      status = "time_limit_exceeded";
    } else if (results.some((r) => r.runtimeError)) {
      status = "runtime_error";
    } else if (allPassed) {
      status = "accepted";
    }

    // Create submission record if user is authenticated
    let submission = null;
    if (userId) {
      submission = await Submission.create({
        userId,
        questionId,
        code,
        language,
        status,
        passedCount,
        totalCount: allTestCases.length,
        // Don't store full test case results for security
      });
    }

    // ============================================
    // AI FEEDBACK INTEGRATION
    // Request AI feedback for non-accepted submissions
    // ============================================
    let aiFeedback = null;
    if (userId && status !== "accepted") {
      try {
        console.log("[Submit] Requesting AI feedback for failed submission...");

        // Get user's recent submission history for context
        const recentSubmissions = await Submission.find({ userId })
          .sort({ createdAt: -1 })
          .limit(20)
          .select("status questionId")
          .lean();

        const userHistorySummary = buildUserHistorySummary(recentSubmissions);

        // Get problem category from question tags
        const problemCategory =
          question.tags?.length > 0
            ? question.tags.join(", ")
            : question.difficulty || "General";

        // Call AI service (non-blocking - we don't fail submission if AI fails)
        aiFeedback = await getAIFeedback({
          userId: userId.toString(),
          problemId: questionId.toString(),
          problemCategory,
          constraints: question.constraints || "No specific constraints",
          code,
          language,
          verdict: status,
          userHistorySummary,
        });

        if (aiFeedback) {
          console.log("[Submit] AI feedback received successfully");
        } else {
          console.log("[Submit] AI feedback unavailable (service may be down)");
        }
      } catch (aiError) {
        // Log but don't fail the submission
        console.error(
          "[Submit] AI feedback error (non-fatal):",
          aiError.message,
        );
        aiFeedback = null;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        submissionId: submission?._id,
        status,
        results: results.map((r) => ({
          label: r.label,
          isHidden: r.isHidden,
          passed: r.passed,
          timedOut: r.timedOut,
          compileError: r.compileError,
          // Only include details for visible tests
          ...(r.isHidden
            ? {}
            : {
                stdin: r.stdin,
                expectedStdout: r.expectedStdout,
                actualStdout: r.actualStdout,
                stderr: r.stderr,
              }),
        })),
        passedCount,
        totalCount: allTestCases.length,
        allPassed,
        // Include AI feedback if available
        aiFeedback: aiFeedback
          ? {
              explanation: aiFeedback.explanation,
              improvementHint: aiFeedback.improvement_hint,
              detectedPattern: aiFeedback.detected_pattern,
              learningRecommendation: aiFeedback.learning_recommendation,
              difficultyAdjustment: aiFeedback.difficulty_adjustment,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("[Submit Code Error]:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to submit code",
    });
  }
};

/**
 * Get user's submission history for a question
 * GET /api/submissions?questionId=...
 */
export const getSubmissions = async (req, res) => {
  try {
    const { questionId } = req.query;
    const userId = req.user._id;

    const query = { userId };
    if (questionId) {
      query.questionId = questionId;
    }

    const submissions = await Submission.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .select("questionId language status passedCount totalCount createdAt")
      .lean();

    res.status(200).json({
      success: true,
      data: submissions,
    });
  } catch (error) {
    console.error("[Get Submissions Error]:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch submissions",
    });
  }
};

/**
 * Get public questions list (for non-admin users)
 * GET /api/questions
 */
export const getPublicQuestions = async (req, res) => {
  try {
    const { page = 1, limit = 20, difficulty, search } = req.query;

    const query = { isActive: true };
    if (difficulty) query.difficulty = difficulty;
    if (search) query.$text = { $search: search };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [questions, total] = await Promise.all([
      Question.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select("title difficulty tags examples createdAt")
        .lean(),
      Question.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: questions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[Get Public Questions Error]:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch questions",
    });
  }
};

/**
 * Get single public question (for non-admin users)
 * GET /api/questions/:id
 */
export const getPublicQuestion = async (req, res) => {
  try {
    const question = await Question.findOne({
      _id: req.params.id,
      isActive: true,
    })
      .select("-__v -createdBy -updatedBy")
      .lean();

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    // Get ONLY visible test cases for public view
    const visibleTestCases = await TestCase.find({
      questionId: req.params.id,
      isActive: true,
      isHidden: false,
    })
      .sort({ order: 1 })
      .select("stdin expectedStdout label");

    res.status(200).json({
      success: true,
      data: {
        ...question,
        testCases: visibleTestCases.map((tc) => ({
          label: tc.label,
          stdin: tc.stdin,
          expectedStdout: tc.expectedStdout,
        })),
      },
    });
  } catch (error) {
    console.error("[Get Public Question Error]:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch question",
    });
  }
};
