import axios from "axios";
import TestCase from "../../models/question/TestCase.js";
import { OAAnswer, OASession } from "../../models/oa/index.js";
import { compareOutputs } from "../../utils/stdinConverter.js";

const PISTON_URL = process.env.PISTON_URL || "https://emkc.org/api/v2/piston";
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

const LANGUAGE_MAP = {
  javascript: { language: "javascript", version: "18.15.0" },
  python: { language: "python", version: "3.10.0" },
  java: { language: "java", version: "15.0.2" },
  cpp: { language: "cpp", version: "10.2.0" },
  c: { language: "c", version: "10.2.0" },
  go: { language: "go", version: "1.16.2" },
  rust: { language: "rust", version: "1.68.2" },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class EvaluationEngine {

  async executeCode(code, language, stdin, timeLimit = 2000) {
    const langConfig = LANGUAGE_MAP[language?.toLowerCase()];
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

        if (
          error.code === "ECONNABORTED" ||
          error.message.includes("exceeds")
        ) {
          break;
        }

        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY * (attempt + 1));
          continue;
        }
      }
    }

    console.error("[Evaluation] Piston execution failed:", lastError?.message);
    throw new Error("Code execution service temporarily unavailable");
  }

  async evaluateCodingSubmission(sessionId, questionId, code, language, userId) {
    console.log("[Evaluation] Evaluating submission for question:", questionId);

    const testCases = await TestCase.find({
      questionId,
      isActive: true,
    }).sort({ order: 1 });

    if (testCases.length === 0) {
      console.warn("[Evaluation] No test cases found for question:", questionId);
      return {
        passed: 0,
        total: 0,
        verdict: "no_test_cases",
        results: [],
      };
    }

    const results = [];
    let passedCount = 0;
    let totalTime = 0;
    let hasCompileError = false;

    for (const tc of testCases) {
      try {
        const execution = await this.executeCode(
          code,
          language,
          tc.stdin,
          tc.timeLimit || 2000
        );

        if (execution.compileError) {
          hasCompileError = true;
          results.push({
            testCaseId: tc._id,
            passed: false,
            executionTime: 0,
            error: execution.stderr,
            isHidden: tc.isHidden,
          });
          break;
        }

        const passed =
          !execution.timedOut &&
          !execution.runtimeError &&
          execution.exitCode === 0 &&
          compareOutputs(execution.stdout, tc.expectedStdout);

        if (passed) passedCount++;
        totalTime += execution.executionTime || 0;

        results.push({
          testCaseId: tc._id,
          passed,
          executionTime: execution.executionTime || 0,
          error: execution.runtimeError ? execution.stderr : null,
          timedOut: execution.timedOut,
          isHidden: tc.isHidden,
        });
      } catch (error) {
        results.push({
          testCaseId: tc._id,
          passed: false,
          error: error.message,
          isHidden: tc.isHidden,
        });
      }
    }

    let verdict = "wrong_answer";
    if (hasCompileError) {
      verdict = "compile_error";
    } else if (passedCount === testCases.length) {
      verdict = "accepted";
    } else if (passedCount > 0) {
      verdict = "partial";
    } else if (results.some((r) => r.timedOut)) {
      verdict = "time_limit_exceeded";
    } else if (results.some((r) => r.error?.includes("runtime"))) {
      verdict = "runtime_error";
    }

    const answer = await OAAnswer.findOneAndUpdate(
      { sessionId, refId: questionId },
      {
        $set: {
          "submission.isSubmitted": true,
          "submission.submittedAt": new Date(),
          "submission.passedCount": passedCount,
          "submission.totalCount": testCases.length,
          "submission.verdict": verdict,
          "submission.executionTime": totalTime,
          "submission.testResults": results.map((r) => ({
            passed: r.passed,
            executionTime: r.executionTime || 0,
            error: r.error,
          })),
          serverUpdatedAt: new Date(),
        },
      },
      { new: true, upsert: false }
    );

    if (answer) {
      answer.pointsEarned = Math.round(
        answer.maxPoints * (passedCount / testCases.length)
      );
      await answer.save();
    }

    console.log(
      `[Evaluation] Result: ${passedCount}/${testCases.length} - ${verdict}`
    );

    return {
      passed: passedCount,
      total: testCases.length,
      verdict,
      results: results.map((r) => ({
        passed: r.passed,
        executionTime: r.executionTime,

        error: r.isHidden ? (r.passed ? null : "Test case failed") : r.error,
      })),
      executionTime: totalTime,
    };
  }

  async runCode(questionId, code, language) {

    const testCases = await TestCase.find({
      questionId,
      isActive: true,
      isHidden: false,
    }).sort({ order: 1 });

    if (testCases.length === 0) {
      return {
        results: [],
        message: "No visible test cases available",
      };
    }

    const results = [];

    for (const tc of testCases) {
      try {
        const execution = await this.executeCode(
          code,
          language,
          tc.stdin,
          tc.timeLimit || 2000
        );

        const passed =
          !execution.compileError &&
          !execution.timedOut &&
          !execution.runtimeError &&
          execution.exitCode === 0 &&
          compareOutputs(execution.stdout, tc.expectedStdout);

        results.push({
          label: tc.label || `Test Case ${results.length + 1}`,
          stdin: tc.stdin,
          expectedOutput: tc.expectedStdout,
          actualOutput: execution.stdout?.trim(),
          passed,
          compileError: execution.compileError,
          runtimeError: execution.runtimeError,
          timedOut: execution.timedOut,
          stderr: execution.stderr,
        });

        if (execution.compileError) break;
      } catch (error) {
        results.push({
          label: tc.label || `Test Case ${results.length + 1}`,
          stdin: tc.stdin,
          expectedOutput: tc.expectedStdout,
          actualOutput: "",
          passed: false,
          error: error.message,
        });
      }
    }

    return {
      results,
      passedCount: results.filter((r) => r.passed).length,
      totalCount: results.length,
    };
  }
}

export default new EvaluationEngine();
