/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * HIDDEN JUDGE CONTROLLER - Secure Hidden Test Case Evaluation
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * This controller handles secure evaluation of submissions against dynamically
 * generated hidden test cases. Key security features:
 * 
 * 1. Test cases are NEVER stored in DB - generated at submission time
 * 2. Hidden inputs are NEVER exposed to frontend
 * 3. Uses trusted reference solutions executed in isolated environment
 * 4. Deterministic generation ensures reproducibility for debugging
 * 
 * Flow:
 *   1. User submits code
 *   2. Generate deterministic seed from userId + submissionId
 *   3. Generate hidden test cases using seed + problem constraints
 *   4. Execute reference solution to get expected outputs
 *   5. Execute user code via Piston API (sandboxed)
 *   6. Compare outputs, return verdict without exposing inputs
 */

import axios from "axios";
import mongoose from "mongoose";
import Question from "../../models/question/Question.js";
import TestCase from "../../models/question/TestCase.js";
import Submission from "../../models/profile/Submission.js";
import { compareOutputs } from "../../utils/stdinConverter.js";
import {
  TestCaseGenerator,
  SeededRandom,
  InputType,
  TestCategory,
  ProblemConfigBuilder,
} from "./testCaseGenerator.js";
import {
  getProblemConfig as getRegistryProblemConfig,
  hasProblem as registryHasProblem,
} from "./problemConfigRegistry.js";

const PISTON_URL = process.env.PISTON_URL || "https://emkc.org/api/v2/piston";
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;
const MAX_CODE_SIZE = 65536;

const LANGUAGE_MAP = {
  javascript: { language: "javascript", version: "18.15.0" },
  python: { language: "python", version: "3.10.0" },
  java: { language: "java", version: "15.0.2" },
  cpp: { language: "cpp", version: "10.2.0" },
  c: { language: "c", version: "10.2.0" },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PISTON EXECUTION - Sandboxed Code Execution
 * ═══════════════════════════════════════════════════════════════════════════════
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

      if (compile && compile.stderr) {
        return {
          stdout: "",
          stderr: compile.stderr.slice(0, 10000),
          exitCode: compile.code || 1,
          timedOut: false,
          compileError: true,
          runtimeError: false,
          memoryExceeded: false,
        };
      }

      const hasRuntimeError =
        (run?.code !== 0 && run?.code !== undefined) ||
        run?.signal === "SIGSEGV" ||
        run?.signal === "SIGABRT";

      const memoryExceeded = run?.signal === "SIGKILL" && !run?.stderr?.includes("timeout");

      return {
        stdout: (run?.stdout || "").slice(0, 100000),
        stderr: (run?.stderr || "").slice(0, 10000),
        exitCode: run?.code ?? 0,
        timedOut: run?.signal === "SIGKILL",
        compileError: false,
        runtimeError: hasRuntimeError && !run?.signal?.includes("KILL"),
        memoryExceeded,
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
 * ═══════════════════════════════════════════════════════════════════════════════
 * PROBLEM CONFIG REGISTRY
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Maps problem types to their test case generation configurations.
 * Each problem type defines:
 *   - Input type and constraints
 *   - Edge cases to test
 *   - Reference solution for computing expected output
 *   - Input/output format converters
 * 
 * IMPORTANT: Reference solutions run server-side and are NEVER exposed.
 */

const PROBLEM_CONFIGS = {
  // ─────────────────────────────────────────────────────────────────────────
  // TWO SUM (Array + Hash Map)
  // ─────────────────────────────────────────────────────────────────────────
  "two-sum": new ProblemConfigBuilder(InputType.ARRAY_INT)
    .setConstraints({
      arrayLength: { min: 2, max: 10000 },
      elementValue: { min: -1000000000, max: 1000000000 },
    })
    .addEdgeCase("Minimum size", { arr: [2, 7], target: 9 })
    .addEdgeCase("Negative numbers", { arr: [-3, 4, 3, 90], target: 0 })
    .addEdgeCase("Same element twice", { arr: [3, 3], target: 6 })
    .setReferenceSolution((input) => {
      const { arr, target } = input;
      const map = new Map();
      for (let i = 0; i < arr.length; i++) {
        const complement = target - arr[i];
        if (map.has(complement)) {
          return [map.get(complement), i];
        }
        map.set(arr[i], i);
      }
      return [-1, -1];
    })
    .setInputToStdin((input) => {
      const lines = [];
      lines.push(`${input.arr.length}`);
      lines.push(input.arr.join(" "));
      lines.push(`${input.target}`);
      return lines.join("\n");
    })
    .setOutputFromStdout((result) => result.join(" "))
    .setCustomGenerator((rng, sizeCategory) => {
      const sizes = { small: 10, medium: 100, large: 1000 };
      const n = sizes[sizeCategory] || 100;
      const arr = rng.randIntArray(n, -100, 100);
      // Ensure a valid solution exists
      const i = rng.randInt(0, n - 2);
      const j = rng.randInt(i + 1, n - 1);
      const target = arr[i] + arr[j];
      return { arr, target };
    })
    .build(),

  // ─────────────────────────────────────────────────────────────────────────
  // MAXIMUM SUBARRAY (Kadane's Algorithm)
  // ─────────────────────────────────────────────────────────────────────────
  "maximum-subarray": new ProblemConfigBuilder(InputType.ARRAY_INT)
    .setConstraints({
      arrayLength: { min: 1, max: 100000 },
      elementValue: { min: -10000, max: 10000 },
    })
    .addEdgeCase("Single positive", { arr: [5] })
    .addEdgeCase("Single negative", { arr: [-3] })
    .addEdgeCase("All negative", { arr: [-2, -1, -3, -4] })
    .addEdgeCase("All positive", { arr: [1, 2, 3, 4, 5] })
    .addAdversarialCase("Max at end", (rng) => {
      const arr = Array(100).fill(-1);
      arr[99] = 1000;
      return { arr };
    })
    .setReferenceSolution((input) => {
      const { arr } = input;
      let maxSum = arr[0];
      let currentSum = arr[0];
      for (let i = 1; i < arr.length; i++) {
        currentSum = Math.max(arr[i], currentSum + arr[i]);
        maxSum = Math.max(maxSum, currentSum);
      }
      return maxSum;
    })
    .setInputToStdin((input) => {
      return `${input.arr.length}\n${input.arr.join(" ")}`;
    })
    .setOutputFromStdout((result) => String(result))
    .build(),

  // ─────────────────────────────────────────────────────────────────────────
  // BINARY SEARCH
  // ─────────────────────────────────────────────────────────────────────────
  "binary-search": new ProblemConfigBuilder(InputType.ARRAY_INT)
    .setConstraints({
      arrayLength: { min: 1, max: 100000 },
      elementValue: { min: -1000000000, max: 1000000000 },
    })
    .addEdgeCase("Single element found", { arr: [5], target: 5 })
    .addEdgeCase("Single element not found", { arr: [5], target: 3 })
    .addEdgeCase("First element", { arr: [1, 2, 3, 4, 5], target: 1 })
    .addEdgeCase("Last element", { arr: [1, 2, 3, 4, 5], target: 5 })
    .addEdgeCase("Not found", { arr: [1, 3, 5, 7, 9], target: 4 })
    .setReferenceSolution((input) => {
      const { arr, target } = input;
      let left = 0, right = arr.length - 1;
      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        if (arr[mid] === target) return mid;
        if (arr[mid] < target) left = mid + 1;
        else right = mid - 1;
      }
      return -1;
    })
    .setInputToStdin((input) => {
      return `${input.arr.length}\n${input.arr.join(" ")}\n${input.target}`;
    })
    .setOutputFromStdout((result) => String(result))
    .setCustomGenerator((rng, sizeCategory) => {
      const sizes = { small: 10, medium: 1000, large: 10000 };
      const n = sizes[sizeCategory] || 1000;
      // Generate sorted array
      let arr = rng.randIntArray(n, -100000, 100000);
      arr = [...new Set(arr)].sort((a, b) => a - b);
      // 50% chance target exists
      const target = rng.randBool(0.5)
        ? arr[rng.randInt(0, arr.length - 1)]
        : rng.randInt(-100001, 100001);
      return { arr, target };
    })
    .build(),

  // ─────────────────────────────────────────────────────────────────────────
  // REVERSE STRING
  // ─────────────────────────────────────────────────────────────────────────
  "reverse-string": new ProblemConfigBuilder(InputType.STRING)
    .setConstraints({
      stringLength: { min: 1, max: 100000 },
      charset: "abcdefghijklmnopqrstuvwxyz",
    })
    .addEdgeCase("Single char", { s: "a" })
    .addEdgeCase("Palindrome", { s: "racecar" })
    .addEdgeCase("Two chars", { s: "ab" })
    .setReferenceSolution((input) => {
      return input.s.split("").reverse().join("");
    })
    .setInputToStdin((input) => input.s)
    .setOutputFromStdout((result) => result)
    .build(),

  // ─────────────────────────────────────────────────────────────────────────
  // VALID PALINDROME
  // ─────────────────────────────────────────────────────────────────────────
  "valid-palindrome": new ProblemConfigBuilder(InputType.STRING)
    .setConstraints({
      stringLength: { min: 1, max: 200000 },
      charset: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ,.!?",
    })
    .addEdgeCase("Single char", { s: "a" })
    .addEdgeCase("Empty after cleanup", { s: ".,!?" })
    .addEdgeCase("Classic", { s: "A man, a plan, a canal: Panama" })
    .addEdgeCase("Not palindrome", { s: "race a car" })
    .setReferenceSolution((input) => {
      const cleaned = input.s.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (cleaned.length === 0) return true;
      let left = 0, right = cleaned.length - 1;
      while (left < right) {
        if (cleaned[left] !== cleaned[right]) return false;
        left++;
        right--;
      }
      return true;
    })
    .setInputToStdin((input) => input.s)
    .setOutputFromStdout((result) => result ? "true" : "false")
    .build(),

  // ─────────────────────────────────────────────────────────────────────────
  // FIBONACCI NUMBER
  // ─────────────────────────────────────────────────────────────────────────
  "fibonacci-number": new ProblemConfigBuilder(InputType.SINGLE_INT)
    .setConstraints({
      value: { min: 0, max: 45 }, // Prevent integer overflow
    })
    .addEdgeCase("Zero", { n: 0 })
    .addEdgeCase("One", { n: 1 })
    .addEdgeCase("Two", { n: 2 })
    .addEdgeCase("Max safe", { n: 45 })
    .setReferenceSolution((input) => {
      const n = input.n;
      if (n <= 1) return n;
      let a = 0, b = 1;
      for (let i = 2; i <= n; i++) {
        [a, b] = [b, a + b];
      }
      return b;
    })
    .setInputToStdin((input) => String(input.n))
    .setOutputFromStdout((result) => String(result))
    .build(),

  // ─────────────────────────────────────────────────────────────────────────
  // DEFAULT CONFIG (Fallback for unmapped problems)
  // ─────────────────────────────────────────────────────────────────────────
  default: new ProblemConfigBuilder(InputType.ARRAY_INT)
    .setConstraints({
      arrayLength: { min: 1, max: 1000 },
      elementValue: { min: -1000, max: 1000 },
    })
    .build(),
};

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GET PROBLEM CONFIG
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Retrieves the test generation config for a problem.
 * Priority: 1. Registry, 2. Inline PROBLEM_CONFIGS, 3. Default
 */
function getProblemConfig(problemSlug) {
  const slug = String(problemSlug).toLowerCase().replace(/\s+/g, "-");
  
  // First check the centralized registry
  const registryConfig = getRegistryProblemConfig(slug);
  if (registryConfig) {
    return registryConfig;
  }
  
  // Fallback to inline configs (for backward compatibility)
  return PROBLEM_CONFIGS[slug] || PROBLEM_CONFIGS.default;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GENERATE SUBMISSION SEED
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Creates a deterministic seed from user + submission IDs.
 * Same inputs always produce same test cases for debugging.
 */
function generateSeed(userId, submissionId) {
  // Combine IDs for unique but reproducible seed
  return `${userId}-${submissionId}`;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * EXECUTE WITH HIDDEN TEST CASES
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Main evaluation function:
 * 1. Generate hidden test cases deterministically
 * 2. Execute user code against each test case
 * 3. Compare outputs with reference solution
 * 4. Return verdict without exposing inputs
 */
async function executeWithHiddenTestCases(options) {
  const {
    code,
    language,
    problemSlug,
    userId,
    submissionId,
    timeLimit = 2000,
    includePresetCases = true,
    presetTestCases = [],
  } = options;

  // Generate deterministic seed
  const seed = generateSeed(userId, submissionId);

  // Get problem configuration
  const config = getProblemConfig(problemSlug);

  // Generate hidden test cases
  const generator = new TestCaseGenerator(config, seed);
  const generatedCases = generator.generateAll({
    edgeCount: 5,
    randomCount: 8,
    stressCount: 3,
    adversarialCount: 4,
  });

  // Combine preset (DB) cases with generated cases
  const allTestCases = [
    ...(includePresetCases ? presetTestCases : []),
    ...generatedCases,
  ];

  const results = [];
  let firstFailingIndex = -1;
  let compileErrorOccurred = false;

  for (let i = 0; i < allTestCases.length; i++) {
    const tc = allTestCases[i];

    try {
      const execution = await executePiston(code, language, tc.stdin, timeLimit);

      // Check for compile error (stop immediately)
      if (execution.compileError) {
        compileErrorOccurred = true;
        results.push({
          testNumber: i + 1,
          category: tc.category || "preset",
          passed: false,
          verdict: "compile_error",
          isHidden: tc.isHidden !== false,
          compileError: true,
          stderr: execution.stderr,
        });
        break;
      }

      // Determine verdict
      let passed = false;
      let verdict = "wrong_answer";

      if (execution.timedOut) {
        verdict = "time_limit_exceeded";
      } else if (execution.memoryExceeded) {
        verdict = "memory_limit_exceeded";
      } else if (execution.runtimeError) {
        verdict = "runtime_error";
      } else if (execution.exitCode === 0) {
        // Compare outputs
        const expected = tc.expectedStdout || tc.expectedOutput || "";
        passed = compareOutputs(execution.stdout, expected);
        verdict = passed ? "accepted" : "wrong_answer";
      }

      // Track first failure
      if (!passed && firstFailingIndex === -1) {
        firstFailingIndex = i;
      }

      results.push({
        testNumber: i + 1,
        category: tc.category || "preset",
        passed,
        verdict,
        isHidden: tc.isHidden !== false,
        timedOut: execution.timedOut,
        runtimeError: execution.runtimeError,
        memoryExceeded: execution.memoryExceeded,
        // SECURITY: Never include stdin or expected output for hidden tests
        ...(tc.isHidden === false
          ? {
              stdin: tc.stdin,
              expectedOutput: tc.expectedStdout || tc.expectedOutput,
              actualOutput: execution.stdout.trim(),
              stderr: execution.stderr,
            }
          : {}),
      });

      // Stop on first failure for efficiency (like LeetCode)
      // Comment out this break if you want to run all tests
      // if (!passed) break;

    } catch (error) {
      results.push({
        testNumber: i + 1,
        category: tc.category || "preset",
        passed: false,
        verdict: "internal_error",
        isHidden: tc.isHidden !== false,
        error: error.message.includes("unavailable")
          ? "Execution service temporarily unavailable"
          : "Internal error",
      });

      if (firstFailingIndex === -1) {
        firstFailingIndex = i;
      }

      // Stop on service error
      if (error.message.includes("unavailable")) {
        break;
      }
    }
  }

  // Compute final verdict
  const passedCount = results.filter((r) => r.passed).length;
  const allPassed = passedCount === allTestCases.length;

  let finalVerdict = "accepted";
  if (compileErrorOccurred) {
    finalVerdict = "compile_error";
  } else if (results.some((r) => r.verdict === "time_limit_exceeded")) {
    finalVerdict = "time_limit_exceeded";
  } else if (results.some((r) => r.verdict === "memory_limit_exceeded")) {
    finalVerdict = "memory_limit_exceeded";
  } else if (results.some((r) => r.verdict === "runtime_error")) {
    finalVerdict = "runtime_error";
  } else if (results.some((r) => r.verdict === "internal_error")) {
    finalVerdict = "internal_error";
  } else if (!allPassed) {
    finalVerdict = "wrong_answer";
  }

  return {
    verdict: finalVerdict,
    passedCount,
    totalCount: allTestCases.length,
    allPassed,
    firstFailingIndex: allPassed ? null : firstFailingIndex,
    // Safe results (hidden inputs never exposed)
    results: results.map((r) => ({
      testNumber: r.testNumber,
      category: r.category,
      passed: r.passed,
      verdict: r.verdict,
      isHidden: r.isHidden,
      // Only include details for visible tests
      ...(r.isHidden
        ? {}
        : {
            stdin: r.stdin,
            expectedOutput: r.expectedOutput,
            actualOutput: r.actualOutput,
            stderr: r.stderr,
          }),
    })),
    // Metadata about the failure (without exposing hidden data)
    failureInfo: allPassed
      ? null
      : {
          testNumber: firstFailingIndex + 1,
          category: results[firstFailingIndex]?.category,
          verdict: results[firstFailingIndex]?.verdict,
          isHidden: results[firstFailingIndex]?.isHidden,
        },
  };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SUBMIT CODE WITH HIDDEN TESTS
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Express handler for code submission with hidden test evaluation.
 * Combines preset test cases from DB with dynamically generated hidden tests.
 */
export async function submitWithHiddenTests(req, res) {
  try {
    const { questionId, code, language } = req.body;
    const userId = req.user?._id;

    // ─────────────────────────────────────────────────────────────────────────
    // Validation
    // ─────────────────────────────────────────────────────────────────────────
    if (!questionId || !code || !language) {
      return res.status(400).json({
        success: false,
        message: "questionId, code, and language are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(questionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid question ID format",
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

    // ─────────────────────────────────────────────────────────────────────────
    // Fetch Question
    // ─────────────────────────────────────────────────────────────────────────
    const question = await Question.findOne({
      _id: questionId,
      isActive: true,
    }).lean();

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Create Submission Record (status: judging)
    // ─────────────────────────────────────────────────────────────────────────
    const submission = await Submission.create({
      userId,
      questionId,
      code,
      language,
      status: "pending",
      problemCategory: question.topic || question.categoryType || "General",
      problemDifficulty: question.difficulty,
      problemTags: question.tags || [],
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Fetch Preset Test Cases (from DB)
    // ─────────────────────────────────────────────────────────────────────────
    const presetTestCases = await TestCase.find({
      questionId,
      isActive: true,
    })
      .sort({ order: 1 })
      .lean();

    // Convert preset cases to standard format
    const formattedPresetCases = presetTestCases.map((tc) => ({
      stdin: tc.stdin,
      expectedStdout: tc.expectedStdout,
      isHidden: tc.isHidden,
      label: tc.label,
      category: "preset",
      timeLimit: tc.timeLimit,
    }));

    // ─────────────────────────────────────────────────────────────────────────
    // Execute with Hidden Test Cases
    // ─────────────────────────────────────────────────────────────────────────
    const problemSlug = question.title?.toLowerCase().replace(/\s+/g, "-") || "default";

    const evaluationResult = await executeWithHiddenTestCases({
      code,
      language,
      problemSlug,
      userId: userId.toString(),
      submissionId: submission._id.toString(),
      timeLimit: presetTestCases[0]?.timeLimit || 2000,
      includePresetCases: true,
      presetTestCases: formattedPresetCases,
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Update Submission Record
    // ─────────────────────────────────────────────────────────────────────────
    submission.status = evaluationResult.verdict;
    submission.passedCount = evaluationResult.passedCount;
    submission.totalCount = evaluationResult.totalCount;
    await submission.save();

    // ─────────────────────────────────────────────────────────────────────────
    // Update Question Stats
    // ─────────────────────────────────────────────────────────────────────────
    await Question.findByIdAndUpdate(questionId, {
      $inc: {
        totalSubmissions: 1,
        acceptedSubmissions: evaluationResult.allPassed ? 1 : 0,
      },
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Build Response (NEVER expose hidden inputs)
    // ─────────────────────────────────────────────────────────────────────────
    const response = {
      success: true,
      data: {
        submissionId: submission._id,
        status: evaluationResult.verdict,
        passedCount: evaluationResult.passedCount,
        totalCount: evaluationResult.totalCount,
        allPassed: evaluationResult.allPassed,

        // Results with hidden inputs redacted
        results: evaluationResult.results.map((r) => ({
          testNumber: r.testNumber,
          category: r.category,
          passed: r.passed,
          verdict: r.verdict,
          isHidden: r.isHidden,
          // Visible tests can show details
          ...(r.isHidden
            ? {}
            : {
                stdin: r.stdin,
                expectedOutput: r.expectedOutput,
                actualOutput: r.actualOutput,
              }),
        })),

        // Failure summary (without exposing hidden data)
        failureInfo: evaluationResult.failureInfo
          ? {
              message: evaluationResult.allPassed
                ? null
                : `Wrong Answer on ${evaluationResult.failureInfo.isHidden ? "hidden " : ""}test case #${evaluationResult.failureInfo.testNumber}`,
              testNumber: evaluationResult.failureInfo.testNumber,
              category: evaluationResult.failureInfo.category,
              verdict: evaluationResult.failureInfo.verdict,
              isHidden: evaluationResult.failureInfo.isHidden,
            }
          : null,
      },
    };

    res.status(200).json(response);

  } catch (error) {
    console.error("[Hidden Judge Error]:", error.message);

    if (error.message.includes("unavailable")) {
      return res.status(503).json({
        success: false,
        message: "Code execution service temporarily unavailable. Please try again later.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to evaluate submission",
    });
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * EXPORTS
 * ═══════════════════════════════════════════════════════════════════════════════
 */
export {
  executeWithHiddenTestCases,
  generateSeed,
  getProblemConfig,
  PROBLEM_CONFIGS,
};
