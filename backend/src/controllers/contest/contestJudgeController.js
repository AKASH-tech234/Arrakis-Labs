import axios from "axios";
import Contest from "../../models/contest/Contest.js";
import ContestRegistration from "../../models/contest/ContestRegistration.js";
import ContestSubmission from "../../models/contest/ContestSubmission.js";
import Question from "../../models/question/Question.js";
import TestCase from "../../models/question/TestCase.js";
import leaderboardService from "../../services/contest/leaderboardService.js";
import wsServer from "../../services/contest/websocketServer.js";
import { compareOutputs } from "../../utils/stdinConverter.js";
import mongoose from "mongoose";

const PISTON_URL = process.env.PISTON_URL || "https://emkc.org/api/v2/piston";
const MAX_CODE_SIZE = 65536;
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getContestLookup(contestId) {
  return mongoose.Types.ObjectId.isValid(contestId)
    ? { _id: contestId }
    : { slug: contestId };
}

/**
 * Execute code with Piston API (with retry)
 */
async function executePiston(code, language, stdin, timeLimit = 2000) {
  const langConfig = LANGUAGE_MAP[language.toLowerCase()];

  if (!langConfig) {
    throw new Error(`Unsupported language: ${language}`);
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
          timeout: Math.max(timeLimit + 10000, 15000),
          validateStatus: (status) => status < 500,
        }
      );

      if (response.status >= 400) {
        throw new Error(`Piston API error: ${response.status}`);
      }

      const { run, compile } = response.data;

      // Check for compile error
      if (compile && compile.stderr) {
        return {
          stdout: "",
          stderr: compile.stderr.slice(0, 5000),
          exitCode: compile.code || 1,
          timedOut: false,
          compileError: true,
          runtimeError: false,
        };
      }

      const hasRuntimeError =
        (run?.code !== 0 && run?.code !== undefined) ||
        run?.signal === "SIGSEGV" ||
        run?.signal === "SIGABRT";

      return {
        stdout: (run?.stdout || "").slice(0, 100000),
        stderr: (run?.stderr || "").slice(0, 5000),
        exitCode: run?.code ?? 0,
        timedOut: run?.signal === "SIGKILL",
        compileError: false,
        runtimeError: hasRuntimeError && !run?.signal?.includes("KILL"),
      };
    } catch (error) {
      lastError = error;

      if (error.code === "ECONNABORTED" || error.message.includes("exceeds")) {
        break;
      }

      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY * (attempt + 1));
        continue;
      }
    }
  }

  throw new Error("Code execution service temporarily unavailable");
}

/**
 * Validate contest submission eligibility
 */
async function validateContestSubmission(contest, registration, problemId, userId) {
  const now = new Date();

  // Check contest is active
  if (contest.status !== "live" && contest.status !== "scheduled") {
    // Check if it should be live
    if (now >= contest.startTime && now < contest.endTime) {
      // Auto-update status
      contest.status = "live";
      await contest.save();
    } else if (now >= contest.endTime) {
      return { valid: false, error: "Contest has ended" };
    } else {
      return { valid: false, error: "Contest has not started yet" };
    }
  }

  // Check if within time bounds
  if (now >= contest.endTime) {
    return { valid: false, error: "Contest has ended" };
  }

  // Check registration status
  if (!registration || registration.status === "disqualified") {
    return { valid: false, error: "You are not registered or have been disqualified" };
  }

  // Check if user has joined
  if (registration.status === "registered" && !registration.joinedAt) {
    return { valid: false, error: "Please join the contest first" };
  }

  // Check if problem is in contest
  const problemInContest = contest.problems.find(
    (p) => p.problem.toString() === problemId.toString()
  );
  if (!problemInContest) {
    return { valid: false, error: "Problem not found in this contest" };
  }

  return { valid: true, problemData: problemInContest };
}

/**
 * CONTEST RUN - Test with visible test cases only
 * POST /api/contest/:contestId/run
 */
export const contestRun = async (req, res) => {
  try {
    const { contestId } = req.params;
    const { problemId, code, language } = req.body;
    const userId = req.user?._id;

    // Input validation
    if (!problemId || !code || !language) {
      return res.status(400).json({
        success: false,
        message: "problemId, code, and language are required",
      });
    }

    if (!LANGUAGE_MAP[language.toLowerCase()]) {
      return res.status(400).json({
        success: false,
        message: `Unsupported language: ${language}`,
      });
    }

    if (code.length > MAX_CODE_SIZE) {
      return res.status(400).json({
        success: false,
        message: "Code exceeds maximum size (64KB)",
      });
    }

    // Get contest and registration (contestId can be id or slug)
    const contest = await Contest.findOne({
      ...getContestLookup(contestId),
      isActive: true,
    });

    if (!contest) {
      return res.status(404).json({ success: false, message: "Contest not found" });
    }

    const registration = await ContestRegistration.findOne({
      contest: contest._id,
      user: userId,
    });

    // Validate submission
    const validation = await validateContestSubmission(
      contest,
      registration,
      problemId,
      userId
    );

    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.error });
    }

    // Get VISIBLE test cases only
    const visibleTestCases = await TestCase.find({
      questionId: problemId,
      isActive: true,
      isHidden: false,
    }).sort({ order: 1 });

    if (visibleTestCases.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No sample test cases available",
      });
    }

    // Execute against visible test cases
    const results = [];

    for (const tc of visibleTestCases) {
      try {
        const execution = await executePiston(code, language, tc.stdin, tc.timeLimit);

        const passed =
          !execution.compileError &&
          !execution.timedOut &&
          execution.exitCode === 0 &&
          compareOutputs(execution.stdout, tc.expectedStdout);

        results.push({
          label: tc.label || `Sample ${results.length + 1}`,
          stdin: tc.stdin,
          expectedOutput: tc.expectedStdout,
          actualOutput: execution.stdout.trim(),
          stderr: execution.stderr,
          passed,
          timedOut: execution.timedOut,
          compileError: execution.compileError,
        });

        if (execution.compileError) break;
      } catch (error) {
        results.push({
          label: tc.label || `Sample ${results.length + 1}`,
          stdin: tc.stdin,
          expectedOutput: tc.expectedStdout,
          actualOutput: "",
          stderr: error.message,
          passed: false,
          error: true,
        });
        break;
      }
    }

    const passedCount = results.filter((r) => r.passed).length;

    res.status(200).json({
      success: true,
      data: {
        results,
        passedCount,
        totalCount: results.length,
        allPassed: passedCount === results.length,
      },
    });
  } catch (error) {
    console.error("[Contest Run Error]:", error.message);
    res.status(500).json({ success: false, message: "Failed to run code" });
  }
};

/**
 * CONTEST SUBMIT - Test with ALL test cases (including hidden)
 * POST /api/contest/:contestId/submit
 */
export const contestSubmit = async (req, res) => {
  try {
    const { contestId } = req.params;
    const { problemId, code, language } = req.body;
    const userId = req.user?._id;

    // Input validation
    if (!problemId || !code || !language) {
      return res.status(400).json({
        success: false,
        message: "problemId, code, and language are required",
      });
    }

    if (!LANGUAGE_MAP[language.toLowerCase()]) {
      return res.status(400).json({
        success: false,
        message: `Unsupported language: ${language}`,
      });
    }

    if (code.length > MAX_CODE_SIZE) {
      return res.status(400).json({
        success: false,
        message: "Code exceeds maximum size (64KB)",
      });
    }

    // Get contest and registration (contestId can be id or slug)
    const contest = await Contest.findOne({
      ...getContestLookup(contestId),
      isActive: true,
    });

    if (!contest) {
      return res.status(404).json({ success: false, message: "Contest not found" });
    }

    const registration = await ContestRegistration.findOne({
      contest: contest._id,
      user: userId,
    });

    // Validate submission
    const validation = await validateContestSubmission(
      contest,
      registration,
      problemId,
      userId
    );

    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.error });
    }

    const { problemData } = validation;

    // Calculate time from start
    const effectiveStart = registration.effectiveStartTime || contest.startTime;
    const timeFromStart = Math.floor((Date.now() - effectiveStart.getTime()) / 1000);

    // Create submission record (pending)
    const submission = await ContestSubmission.create({
      contest: contest._id,
      user: userId,
      problem: problemId,
      registration: registration._id,
      problemLabel: problemData.label,
      code,
      language,
      submittedAt: new Date(),
      timeFromStart,
      verdict: "judging",
      clientIP: req.ip,
      userAgent: req.get("user-agent"),
    });

    // Get ALL test cases (visible + hidden)
    const allTestCases = await TestCase.find({
      questionId: problemId,
      isActive: true,
    }).sort({ order: 1 });

    if (allTestCases.length === 0) {
      submission.verdict = "internal_error";
      submission.errorMessage = "No test cases configured";
      await submission.save();
      return res.status(500).json({
        success: false,
        message: "Problem not properly configured",
      });
    }

    // Execute against all test cases
    let testsPassed = 0;
    let firstFailedTest = null;
    let verdict = "accepted";
    let maxExecutionTime = 0;
    let maxMemoryUsed = 0;
    const testResults = [];

    for (let i = 0; i < allTestCases.length; i++) {
      const tc = allTestCases[i];

      try {
        const execution = await executePiston(code, language, tc.stdin, tc.timeLimit);

        maxExecutionTime = Math.max(maxExecutionTime, execution.executionTime || 0);

        const passed =
          !execution.compileError &&
          !execution.timedOut &&
          !execution.runtimeError &&
          execution.exitCode === 0 &&
          compareOutputs(execution.stdout, tc.expectedStdout);

        testResults.push({
          testIndex: i + 1,
          passed,
          executionTime: execution.executionTime || 0,
          memoryUsed: execution.memoryUsed || 0,
        });

        if (passed) {
          testsPassed++;
        } else {
          if (firstFailedTest === null) firstFailedTest = i + 1;

          if (execution.compileError) {
            verdict = "compile_error";
            submission.errorMessage = execution.stderr;
            break;
          } else if (execution.timedOut) {
            verdict = "time_limit_exceeded";
          } else if (execution.runtimeError) {
            verdict = "runtime_error";
            submission.errorMessage = execution.stderr;
          } else {
            verdict = "wrong_answer";
          }
        }
      } catch (error) {
        testResults.push({
          testIndex: i + 1,
          passed: false,
          error: true,
        });

        if (firstFailedTest === null) firstFailedTest = i + 1;
        verdict = "internal_error";
        break;
      }
    }

    // Update submission
    submission.verdict = verdict;
    submission.testsPassed = testsPassed;
    submission.testsTotal = allTestCases.length;
    submission.executionTime = maxExecutionTime;
    submission.memoryUsed = maxMemoryUsed;
    submission.firstFailedTest = firstFailedTest;
    submission.testResults = testResults;
    submission.score = verdict === "accepted" ? problemData.points : 0;
    await submission.save();

    // Update registration with attempt
    const isAccepted = verdict === "accepted";
    await registration.recordAttempt(
      problemId,
      isAccepted,
      submission._id,
      contest.startTime,
      problemData.points,
      contest.penaltyRules.wrongSubmissionPenalty
    );

    // Update Redis leaderboard
    if (isAccepted) {
      const contestKeyId = contest._id.toString();

      await leaderboardService.updateScore(contestKeyId, userId.toString(), {
        problemsSolved: registration.problemsSolved,
        totalTimeSeconds: registration.totalTime,
        penaltyMinutes: registration.totalPenalty,
      });

      // Record solve for problem stats
      await leaderboardService.recordSolve(
        contestKeyId,
        userId.toString(),
        problemId.toString(),
        timeFromStart
      );

      // Get solve count for notification
      const solveCount = await leaderboardService.getProblemSolveCount(
        contestKeyId,
        problemId.toString()
      );

      // Send WebSocket notification
        wsServer.notifySubmissionResult(contest._id.toString(), userId.toString(), {
        submissionId: submission._id,
        problemLabel: problemData.label,
        verdict,
        testsPassed,
        testsTotal: allTestCases.length,
        solveCount,
      });
    } else {
      // Notify user of result
      wsServer.notifySubmissionResult(contest._id.toString(), userId.toString(), {
        submissionId: submission._id,
        problemLabel: problemData.label,
        verdict,
        testsPassed,
        testsTotal: allTestCases.length,
        firstFailedTest,
      });
    }

    // Response (safe, no hidden data)
    res.status(200).json({
      success: true,
      data: submission.toUserResponse(true),
    });
  } catch (error) {
    console.error("[Contest Submit Error]:", error.message);
    res.status(500).json({ success: false, message: "Failed to submit code" });
  }
};

/**
 * Get user's submissions for a contest problem
 * GET /api/contest/:contestId/submissions
 */
export const getContestSubmissions = async (req, res) => {
  try {
    const { contestId } = req.params;
    const { problemId } = req.query;
    const userId = req.user?._id;

    const contest = await Contest.findOne({
      ...getContestLookup(contestId),
      isActive: true,
    }).lean();

    if (!contest) {
      return res.status(404).json({ success: false, message: "Contest not found" });
    }

    const query = { contest: contest._id, user: userId };
    if (problemId) query.problem = problemId;

    const submissions = await ContestSubmission.find(query)
      .sort({ submittedAt: -1 })
      .limit(50)
      .select(
        "problemLabel language verdict testsPassed testsTotal submittedAt timeFromStart executionTime"
      )
      .lean();

    res.status(200).json({
      success: true,
      data: submissions,
    });
  } catch (error) {
    console.error("[Get Contest Submissions Error]:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch submissions" });
  }
};

/**
 * Get specific submission details
 * GET /api/contest/:contestId/submissions/:submissionId
 */
export const getSubmissionDetails = async (req, res) => {
  try {
    const { contestId, submissionId } = req.params;
    const userId = req.user?._id;

    const contest = await Contest.findOne({
      ...getContestLookup(contestId),
      isActive: true,
    }).lean();

    if (!contest) {
      return res.status(404).json({ success: false, message: "Contest not found" });
    }

    const submission = await ContestSubmission.findOne({
      _id: submissionId,
      contest: contest._id,
      user: userId,
    });

    if (!submission) {
      return res.status(404).json({ success: false, message: "Submission not found" });
    }

    // Check if contest is still active
    const isContestActive = contest && new Date() < new Date(contest.endTime);

    res.status(200).json({
      success: true,
      data: submission.toUserResponse(isContestActive),
    });
  } catch (error) {
    console.error("[Get Submission Details Error]:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch submission" });
  }
};

export default {
  contestRun,
  contestSubmit,
  getContestSubmissions,
  getSubmissionDetails,
};
