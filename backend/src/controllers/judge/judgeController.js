import axios from "axios";
import mongoose from "mongoose";
import Question from "../../models/question/Question.js";
import TestCase from "../../models/question/TestCase.js";
import Submission from "../../models/profile/Submission.js";
import { compareOutputs } from "../../utils/stdinConverter.js";
import { inferIOFormatsFromTestCases } from "../../utils/ioFormatInference.js";
import {
  getAIFeedback,
  buildUserHistorySummary,
  transformMIMInsights,
} from "../../services/ai/aiService.js";
import {
  getAttemptNumber,
  updateUserAIProfile,
} from "../../utils/userStatsAggregator.js";

import {
  hasGeneratorForType,
  generateTestsByType,
  getAllRegisteredTypes,
  normalizeType,
} from "../../services/judge/typeGeneratorRegistry.js";

import {
  hasProblem as hasRegisteredProblem,
  getProblemConfig,
  normalizeSlug,
} from "../../services/judge/problemConfigRegistry.js";
import { TestCaseGenerator } from "../../services/judge/testCaseGenerator.js";

import {
  generateDynamicTestInputs,
  computeExpectedOutputs,
} from "../../services/judge/dynamicTestGenerator.js";

const PISTON_URL = process.env.PISTON_URL || "https://emkc.org/api/v2/piston";
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;
const MAX_CODE_SIZE = 65536;
const MAX_STDIN_SIZE = 1024 * 1024;

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

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

async function executePiston(code, language, stdin, timeLimit = 2000) {
  const langConfig = LANGUAGE_MAP[language.toLowerCase()];

  if (!langConfig) {
    throw new Error(`Unsupported language: ${language}`);
  }

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
          timeout: Math.max(timeLimit + 10000, 15000),
          validateStatus: (status) => status < 500,
        },
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
        };
      }

      const hasRuntimeError =
        (run?.code !== 0 && run?.code !== undefined) ||
        run?.signal === "SIGSEGV" ||
        run?.signal === "SIGABRT";

      return {
        stdout: (run?.stdout || "").slice(0, 100000),
        stderr: (run?.stderr || "").slice(0, 10000),
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
        console.warn(`[Piston] Attempt ${attempt + 1} failed, retrying...`);
        await sleep(RETRY_DELAY * (attempt + 1));
        continue;
      }
    }
  }

  console.error("[Piston] All retries failed:", lastError?.message);
  throw new Error("Code execution service temporarily unavailable");
}

export const runCode = async (req, res) => {
  try {
    const { questionId, code, language } = req.body;

    if (!questionId || !code || !language) {
      return res.status(400).json({
        success: false,
        message: "questionId, code, and language are required",
      });
    }

    if (!isValidObjectId(questionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid question ID format",
      });
    }

    if (!LANGUAGE_MAP[language.toLowerCase()]) {
      return res.status(400).json({
        success: false,
        message: `Unsupported language. Supported: ${Object.keys(LANGUAGE_MAP).join(", ")}`,
      });
    }

    if (typeof code !== "string" || code.length > MAX_CODE_SIZE) {
      return res.status(400).json({
        success: false,
        message: "Invalid code or code exceeds maximum size (64KB)",
      });
    }

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
          stdin: tc.stdin,
          expectedStdout: tc.expectedStdout,
          actualStdout: execution.stdout.trim(),
          stderr: execution.stderr,
          passed,
          timedOut: execution.timedOut,
          compileError: execution.compileError,
        });

        if (execution.compileError) {
          break;
        }
      } catch (error) {
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

export const submitCode = async (req, res) => {
  try {
    const { questionId, code, language } = req.body;
    const userId = req.user?._id;

    console.log("\n" + "=".repeat(80));
    console.log("📝 CODE SUBMISSION");
    console.log("=".repeat(80));
    console.log("👤 User ID:", userId?.toString());
    console.log("🎯 Question ID:", questionId);
    console.log("💻 Language:", language);
    console.log("📊 Code Length:", code?.length || 0, "bytes");
    console.log("=".repeat(80) + "\n");

    if (!questionId || !code || !language) {
      return res.status(400).json({
        success: false,
        message: "questionId, code, and language are required",
      });
    }

    if (!isValidObjectId(questionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid question ID format",
      });
    }

    if (!LANGUAGE_MAP[language.toLowerCase()]) {
      return res.status(400).json({
        success: false,
        message: `Unsupported language. Supported: ${Object.keys(LANGUAGE_MAP).join(", ")}`,
      });
    }

    if (typeof code !== "string" || code.length > MAX_CODE_SIZE) {
      return res.status(400).json({
        success: false,
        message: "Invalid code or code exceeds maximum size (64KB)",
      });
    }

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

    console.log("✅ Question found:", question.title);
    console.log("   Type:", question.categoryType || question.topic || "Unknown");
    console.log("   Difficulty:", question.difficulty || "Unknown");

    console.log("🧪 Fetching test cases from MongoDB...");
    const allTestCases = await TestCase.find({
      questionId,
      isActive: true,
    }).sort({ order: 1 });

    console.log("✅ Retrieved", allTestCases.length, "DB test cases");
    console.log("   Hidden:", allTestCases.filter((tc) => tc.isHidden).length);
    console.log(
      "   Visible:",
      allTestCases.filter((tc) => !tc.isHidden).length,
    );

    let generatedHiddenCases = [];

    const problemSlug = question.slug || normalizeSlug(question.title || "");
    const problemType = question.categoryType || question.topic || "";

    console.log(`\n[HiddenJudge] ═══════════════════════════════════════════════════`);
    console.log(`[HiddenJudge] Problem: "${question.title}"`);
    console.log(`[HiddenJudge] Slug: "${problemSlug}"`);
    console.log(`[HiddenJudge] Type: "${problemType}"`);

    if (hasRegisteredProblem(problemSlug)) {
      console.log(`[HiddenJudge] ✅ Per-problem config FOUND (has reference solution)`);
      try {
        const problemConfig = getProblemConfig(problemSlug);

        const submissionSeed = `${userId?.toString() || "anon"}-${questionId}`;

        const generator = new TestCaseGenerator(problemConfig, submissionSeed);
        generatedHiddenCases = generator.generateAll({
          edgeCount: 3,
          randomCount: 5,
          stressCount: 2,
          adversarialCount: 2,
        });

        generatedHiddenCases = generatedHiddenCases.filter(tc => tc.expectedStdout !== null);

        console.log(`[HiddenJudge] Generated ${generatedHiddenCases.length} hidden test cases with reference solutions`);
      } catch (genError) {
        console.error(`[HiddenJudge] ❌ Generation failed: ${genError.message}`);
        generatedHiddenCases = [];
      }
    } else {

      console.log(`[HiddenJudge] ⚠️ No per-problem config registered`);
      console.log(`[HiddenJudge] 🔄 Using DYNAMIC test generation (analyze existing tests)`);

      try {
        const submissionSeed = `${userId?.toString() || "anon"}-${questionId}-dynamic`;

        const dynamicInputs = generateDynamicTestInputs(
          question,
          allTestCases,
          submissionSeed,
          { edgeCount: 3, randomCount: 5, stressCount: 2 }
        );

        console.log(`[HiddenJudge] Generated ${dynamicInputs.length} dynamic test INPUTS`);
        console.log(`[HiddenJudge] Expected outputs will be computed from user's solution`);

        generatedHiddenCases = dynamicInputs.map((input, idx) => ({
          stdin: input.stdin,
          expectedStdout: null,
          category: input.category || "dynamic",
          label: input.label || `Dynamic #${idx + 1}`,
          isHidden: true,
          needsOutputComputation: true,
        }));
      } catch (genError) {
        console.error(`[HiddenJudge] ❌ Dynamic generation failed: ${genError.message}`);
        generatedHiddenCases = [];
      }
    }

    console.log(`[HiddenJudge] ═══════════════════════════════════════════════════\n`);

    const dbVisibleTests = allTestCases.filter(tc => !tc.isHidden).map(tc => ({
      stdin: tc.stdin,
      expectedStdout: tc.expectedStdout,
      label: tc.label,
      isHidden: false,
      timeLimit: tc.timeLimit,
      category: "db_visible",
      fromDB: true,
    }));

    const dbHiddenTests = allTestCases.filter(tc => tc.isHidden).map(tc => ({
      stdin: tc.stdin,
      expectedStdout: tc.expectedStdout,
      label: tc.label,
      isHidden: true,
      timeLimit: tc.timeLimit,
      category: "db_hidden",
      fromDB: true,
    }));

    console.log(`📊 DB Test Cases: ${dbVisibleTests.length} visible, ${dbHiddenTests.length} hidden`);
    console.log(`📊 Dynamic Test Inputs: ${generatedHiddenCases.length} (outputs pending)`);

    if (dbVisibleTests.length === 0 && dbHiddenTests.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No test cases available for this question",
      });
    }

    const results = [];
    let compileErrorOccurred = false;
    let firstFailingIndex = -1;
    let visibleTestsPassed = true;

    console.log(`\n[Phase 1] Running ${dbVisibleTests.length} visible test cases...`);

    for (let i = 0; i < dbVisibleTests.length; i++) {
      const tc = dbVisibleTests[i];
      try {
        const execution = await executePiston(
          code,
          language,
          tc.stdin,
          tc.timeLimit || 2000,
        );

        const passed =
          !execution.compileError &&
          !execution.timedOut &&
          execution.exitCode === 0 &&
          compareOutputs(execution.stdout, tc.expectedStdout);

        if (!passed) {
          visibleTestsPassed = false;
          if (firstFailingIndex === -1) firstFailingIndex = i;
        }

        results.push({
          label: tc.label,
          isHidden: tc.isHidden,
          category: tc.category,
          stdin: tc.stdin,
          expectedStdout: tc.expectedStdout,
          actualStdout: execution.stdout.trim(),
          stderr: execution.stderr,
          passed,
          timedOut: execution.timedOut,
          compileError: execution.compileError,
          runtimeError: execution.runtimeError || false,
        });

        if (execution.compileError) {
          compileErrorOccurred = true;
          visibleTestsPassed = false;
          break;
        }
      } catch (error) {
        visibleTestsPassed = false;
        const isServiceError = error.message.includes("unavailable");
        if (firstFailingIndex === -1) firstFailingIndex = results.length;

        results.push({
          label: tc.label,
          isHidden: tc.isHidden,
          stdin: tc.stdin,
          expectedStdout: tc.expectedStdout,
          actualStdout: "",
          stderr: isServiceError ? "Execution service temporarily unavailable" : error.message,
          passed: false,
          error: true,
          serviceError: isServiceError,
        });

        if (isServiceError) break;
      }
    }

    console.log(`[Phase 1] Visible tests result: ${visibleTestsPassed ? "✅ ALL PASSED" : "❌ FAILED"}`);

    if (!compileErrorOccurred && dbHiddenTests.length > 0) {
      console.log(`\n[Phase 2] Running ${dbHiddenTests.length} DB hidden test cases...`);

      for (let i = 0; i < dbHiddenTests.length; i++) {
        const tc = dbHiddenTests[i];
        try {
          const execution = await executePiston(
            code,
            language,
            tc.stdin,
            tc.timeLimit || 2000,
          );

          const passed =
            !execution.compileError &&
            !execution.timedOut &&
            execution.exitCode === 0 &&
            compareOutputs(execution.stdout, tc.expectedStdout);

          if (!passed && firstFailingIndex === -1) {
            firstFailingIndex = results.length;
          }

          results.push({
            label: tc.label,
            isHidden: true,
            category: tc.category,
            stdin: tc.stdin,
            expectedStdout: tc.expectedStdout,
            actualStdout: execution.stdout.trim(),
            stderr: execution.stderr,
            passed,
            timedOut: execution.timedOut,
            compileError: execution.compileError,
            runtimeError: execution.runtimeError || false,
          });

          if (execution.compileError) {
            compileErrorOccurred = true;
            break;
          }
        } catch (error) {
          const isServiceError = error.message.includes("unavailable");
          if (firstFailingIndex === -1) firstFailingIndex = results.length;

          results.push({
            label: tc.label,
            isHidden: true,
            stdin: tc.stdin,
            expectedStdout: tc.expectedStdout,
            actualStdout: "",
            stderr: isServiceError ? "Execution service temporarily unavailable" : error.message,
            passed: false,
            error: true,
            serviceError: isServiceError,
          });

          if (isServiceError) break;
        }
      }
    }

    const dynamicTestsNeedingOutput = generatedHiddenCases.filter(tc => tc.needsOutputComputation);

    if (!compileErrorOccurred && visibleTestsPassed && dynamicTestsNeedingOutput.length > 0) {
      console.log(`\n[Phase 3] Computing outputs for ${dynamicTestsNeedingOutput.length} dynamic tests...`);
      console.log(`[Phase 3] Using user's solution as reference (passed visible tests)`);

      for (let i = 0; i < dynamicTestsNeedingOutput.length; i++) {
        const tc = dynamicTestsNeedingOutput[i];
        try {

          const referenceExecution = await executePiston(
            code,
            language,
            tc.stdin,
            3000,
          );

          if (referenceExecution.compileError || referenceExecution.timedOut || referenceExecution.exitCode !== 0) {

            console.log(`[Phase 3] Skipping dynamic test #${i + 1} - user code failed`);
            continue;
          }

          const expectedOutput = referenceExecution.stdout.trim();

          const verifyExecution = await executePiston(
            code,
            language,
            tc.stdin,
            3000,
          );

          const passed =
            !verifyExecution.compileError &&
            !verifyExecution.timedOut &&
            verifyExecution.exitCode === 0 &&
            compareOutputs(verifyExecution.stdout, expectedOutput);

          results.push({
            label: tc.label || `Dynamic #${i + 1}`,
            isHidden: true,
            category: tc.category || "dynamic",
            stdin: tc.stdin,
            expectedStdout: expectedOutput,
            actualStdout: verifyExecution.stdout.trim(),
            stderr: verifyExecution.stderr,
            passed,
            timedOut: verifyExecution.timedOut,
            compileError: verifyExecution.compileError,
            runtimeError: verifyExecution.runtimeError || false,
            dynamicallyGenerated: true,
          });

        } catch (error) {
          console.error(`[Phase 3] Error on dynamic test #${i + 1}: ${error.message}`);

        }
      }

      console.log(`[Phase 3] Completed dynamic test execution`);
    } else if (generatedHiddenCases.length > 0 && generatedHiddenCases[0].expectedStdout !== null) {

      console.log(`\n[Phase 3] Running ${generatedHiddenCases.length} pre-generated hidden tests...`);

      for (let i = 0; i < generatedHiddenCases.length; i++) {
        const tc = generatedHiddenCases[i];
        if (tc.needsOutputComputation) continue;

        try {
          const execution = await executePiston(
            code,
            language,
            tc.stdin,
            tc.timeLimit || 2000,
          );

          const passed =
            !execution.compileError &&
            !execution.timedOut &&
            execution.exitCode === 0 &&
            compareOutputs(execution.stdout, tc.expectedStdout);

          if (!passed && firstFailingIndex === -1) {
            firstFailingIndex = results.length;
          }

          results.push({
            label: tc.label || `Generated #${i + 1}`,
            isHidden: true,
            category: tc.category || "generated",
            stdin: tc.stdin,
            expectedStdout: tc.expectedStdout,
            actualStdout: execution.stdout.trim(),
            stderr: execution.stderr,
            passed,
            timedOut: execution.timedOut,
            compileError: execution.compileError,
            runtimeError: execution.runtimeError || false,
          });

          if (execution.compileError) {
            compileErrorOccurred = true;
            break;
          }
        } catch (error) {
          const isServiceError = error.message.includes("unavailable");
          if (firstFailingIndex === -1) firstFailingIndex = results.length;

          results.push({
            label: tc.label || `Generated #${i + 1}`,
            isHidden: true,
            stdin: tc.stdin,
            expectedStdout: tc.expectedStdout,
            actualStdout: "",
            stderr: isServiceError ? "Execution service temporarily unavailable" : error.message,
            passed: false,
            error: true,
            serviceError: isServiceError,
          });

          if (isServiceError) break;
        }
      }
    }

    console.log(`\n📊 Total test cases executed: ${results.length}`);
    console.log(`📊 Passed: ${results.filter(r => r.passed).length}, Failed: ${results.filter(r => !r.passed).length}`);

    const passedCount = results.filter((r) => r.passed).length;
    const hasServiceError = results.some((r) => r.serviceError);
    const allPassed = passedCount === results.length && !hasServiceError;

    let status = "wrong_answer";
    if (hasServiceError) {
      status = "runtime_error";
    } else if (compileErrorOccurred) {
      status = "compile_error";
    } else if (results.some((r) => r.timedOut)) {
      status = "time_limit_exceeded";
    } else if (results.some((r) => r.runtimeError)) {
      status = "runtime_error";
    } else if (allPassed) {
      status = "accepted";
    }

    let submission = null;
    if (userId) {

      const attemptNumber = await getAttemptNumber(userId, questionId);

      const problemCategory =
        question.topic ||
        (question.tags?.length > 0 ? question.tags[0] : "General");

      submission = await Submission.create({
        userId,
        questionId,
        code,
        language,
        status,
        passedCount,
        totalCount: results.length,

        attemptNumber,

        problemCategory,
        problemDifficulty: question.difficulty,
        problemTags: question.tags || [],

      });

      updateUserAIProfile(userId).catch((err) =>
        console.error("[Submit] AI profile update failed:", err.message),
      );
    }

    const AI_ELIGIBLE_STATUSES = [
      "accepted",
      "wrong_answer",
      "time_limit_exceeded",
      "runtime_error",
    ];

    let aiFeedback = null;
    if (userId && AI_ELIGIBLE_STATUSES.includes(status)) {
      try {
        console.log(
          `[Submit] Requesting AI feedback for ${status} submission...`,
        );

        const recentSubmissions = await Submission.find({ userId })
          .sort({ createdAt: -1 })
          .limit(20)
          .select("status questionId")
          .lean();

        const userHistorySummary = buildUserHistorySummary(recentSubmissions);

        const problemCategory =
          question.topic ||
          (question.tags?.length > 0 ? question.tags[0] : "General");

        const { getUserAIProfile } =
          await import("../../utils/userStatsAggregator.js");
        const userProfile = await getUserAIProfile(userId).catch(() => null);

        const failingTestCase = firstFailingIndex >= 0 ? {
          index: firstFailingIndex,
          total: results.length,
          isHidden: results[firstFailingIndex]?.isHidden || false,
          input: results[firstFailingIndex]?.stdin || "",
          expectedOutput: results[firstFailingIndex]?.expectedStdout || "",
          actualOutput: results[firstFailingIndex]?.actualStdout || "",
          error: results[firstFailingIndex]?.stderr || "",
        } : null;

        aiFeedback = await getAIFeedback({
          userId: userId.toString(),
          problemId: questionId.toString(),
          problemCategory,
          constraints: question.constraints || "No specific constraints",
          code,
          language,
          verdict: status,
          userHistorySummary,

          failingTestCase,
          passedCount,
          totalCount: results.length,

          problem: {
            title: question.title,
            difficulty: question.difficulty,
            tags: question.tags || [],
            topic: question.topic || problemCategory,
            expectedApproach: question.expectedApproach || null,
            commonMistakes: question.commonMistakes || [],
            timeComplexityHint: question.timeComplexityHint || null,
            spaceComplexityHint: question.spaceComplexityHint || null,
          },
          userProfile,
        });

        if (aiFeedback) {
          console.log("[Submit] AI feedback received successfully");

          if (submission) {
            submission.aiFeedbackReceived = true;
            await submission.save();
          }
        } else {
          console.log("[Submit] AI feedback unavailable (service may be down)");
        }
      } catch (aiError) {
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
        allPassed,

        firstFailingIndex: !allPassed ? firstFailingIndex : null,
        results: results.map((r, idx) => {

          const shouldExposeDetails = !allPassed || !r.isHidden;

          return {
            label: r.label,
            isHidden: r.isHidden,
            passed: r.passed,
            timedOut: r.timedOut,
            compileError: r.compileError,
            runtimeError: r.runtimeError || false,

            ...(shouldExposeDetails
              ? {
                  stdin: r.stdin,
                  expectedStdout: r.expectedStdout,
                  actualStdout: r.actualStdout,
                  stderr: r.stderr,
                }
              : {}),
          };
        }),
        passedCount,
        totalCount: results.length,
        aiFeedback: aiFeedback
          ? {
              hints: aiFeedback.hints || [],
              explanation: aiFeedback.explanation,
              improvementHint: aiFeedback.improvement_hint,
              detectedPattern: aiFeedback.detected_pattern,
              feedbackType: aiFeedback.feedback_type || (allPassed ? "success_feedback" : "error_feedback"),
              learningRecommendation: aiFeedback.learning_recommendation,
              difficultyAdjustment: aiFeedback.difficulty_adjustment,
              optimizationTips: aiFeedback.optimization_tips || [],
              complexityAnalysis: aiFeedback.complexity_analysis,
              edgeCases: aiFeedback.edge_cases || [],

              mimInsights: transformMIMInsights(aiFeedback.mim_insights),

              rootCause: aiFeedback.root_cause || null,
              rootCauseSubtype: aiFeedback.root_cause_subtype || null,
              failureMechanism: aiFeedback.failure_mechanism || null,
              correctCode: aiFeedback.correct_code || null,
              correctCodeExplanation:
                aiFeedback.correct_code_explanation || null,
              conceptReinforcement: aiFeedback.concept_reinforcement || null,

              failingTestCaseRef: firstFailingIndex >= 0 ? {
                index: firstFailingIndex,
                label: results[firstFailingIndex]?.label || `Test Case ${firstFailingIndex + 1}`,
                isHidden: results[firstFailingIndex]?.isHidden || false,
              } : null,
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

export const getSubmissions = async (req, res) => {
  try {
    const { questionId } = req.query;
    const userId = req.user._id;

    const query = { userId };
    if (questionId) {

      if (mongoose.Types.ObjectId.isValid(questionId)) {
        query.questionId = questionId;
      } else {

        const question = await Question.findOne({ slug: questionId }).select("_id").lean();
        if (question) {
          query.questionId = question._id;
        } else {

          return res.status(200).json({
            success: true,
            data: [],
          });
        }
      }
    }

    const submissions = await Submission.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .select("_id questionId language status passedCount totalCount createdAt")
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
        .select("title difficulty tags categoryType examples createdAt primaryCompany companies")
        .lean(),
      Question.countDocuments(query),
    ]);

    const normalizedQuestions = questions.map(q => ({
      ...q,
      primaryCompany: q.primaryCompany
        ? q.primaryCompany.charAt(0).toUpperCase() + q.primaryCompany.slice(1).toLowerCase()
        : null,
      companies: (q.companies || []).map(c =>
        c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()
      ),
    }));

    res.status(200).json({
      success: true,
      data: normalizedQuestions,
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

export const getPublicQuestion = async (req, res) => {
  try {
    const { id } = req.params;

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id, isActive: true }
      : { slug: id, isActive: true };

    const question = await Question.findOne(query)
      .select("-__v -createdBy -updatedBy")
      .lean();

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    const visibleTestCases = await TestCase.find({
      questionId: question._id,
      isActive: true,
      isHidden: false,
    })
      .sort({ order: 1 })
      .select("stdin expectedStdout label");

    const allTestCasesForFormat = await TestCase.find({
      questionId: question._id,
      isActive: true,
    })
      .sort({ order: 1 })
      .select("stdin expectedStdout")
      .lean();

    const { inputFormat, outputFormat } = inferIOFormatsFromTestCases(
      allTestCasesForFormat,
    );

    const normalizedPrimaryCompany = question.primaryCompany
      ? question.primaryCompany.charAt(0).toUpperCase() + question.primaryCompany.slice(1).toLowerCase()
      : null;
    const normalizedCompanies = (question.companies || []).map(c =>
      c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()
    );

    res.status(200).json({
      success: true,
      data: {
        ...question,
        primaryCompany: normalizedPrimaryCompany,
        companies: normalizedCompanies,
        inputFormat,
        outputFormat,
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
