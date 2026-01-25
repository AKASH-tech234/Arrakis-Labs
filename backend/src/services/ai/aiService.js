import axios from "axios";

/**
 * AI Service Client
 * Handles communication with the FastAPI AI service
 */

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const AI_TIMEOUT_MS = 90000; // 90 seconds for AI processing

// ═══════════════════════════════════════════════════════════════════════════════
// STRUCTURED LOGGING
// ═══════════════════════════════════════════════════════════════════════════════

const LOG_PREFIX = {
  INFO: "\x1b[36m[AI-SVC]\x1b[0m", // Cyan
  SUCCESS: "\x1b[32m[AI-SVC]\x1b[0m", // Green
  WARN: "\x1b[33m[AI-SVC]\x1b[0m", // Yellow
  ERROR: "\x1b[31m[AI-SVC]\x1b[0m", // Red
  HTTP: "\x1b[35m[AI-SVC]\x1b[0m", // Magenta
};

const log = {
  info: (msg, data) => {
    console.log(`${LOG_PREFIX.INFO} ${msg}`, data ? JSON.stringify(data) : "");
  },
  success: (msg, data) => {
    console.log(
      `${LOG_PREFIX.SUCCESS} ✓ ${msg}`,
      data ? JSON.stringify(data) : "",
    );
  },
  warn: (msg, data) => {
    console.warn(
      `${LOG_PREFIX.WARN} ⚠ ${msg}`,
      data ? JSON.stringify(data) : "",
    );
  },
  error: (msg, data) => {
    console.error(
      `${LOG_PREFIX.ERROR} ✗ ${msg}`,
      data ? JSON.stringify(data) : "",
    );
  },
  http: (method, url, status, duration) => {
    const statusColor = status >= 400 ? "\x1b[31m" : "\x1b[32m";
    console.log(
      `${LOG_PREFIX.HTTP} ${method} ${url} ${statusColor}${status}\x1b[0m ${duration}ms`,
    );
  },
};

/**
 * Map backend verdict status to AI service expected format
 */
const VERDICT_MAP = {
  accepted: "Accepted",
  wrong_answer: "Wrong Answer",
  time_limit_exceeded: "Time Limit Exceeded",
  memory_limit_exceeded: "Memory Limit Exceeded",
  runtime_error: "Runtime Error",
  compile_error: "Compile Error",
  internal_error: "Internal Error",
  pending: "Pending",
  running: "Running",
};

/**
 * Map backend status to error_type for AI service
 */
const ERROR_TYPE_MAP = {
  wrong_answer: "Wrong Answer",
  time_limit_exceeded: "TLE",
  memory_limit_exceeded: "MLE",
  runtime_error: "Runtime Error",
  compile_error: "Compile Error",
};

/**
 * Build user history summary from submission history
 * @param {Array} submissions - Recent submissions for the user
 * @returns {string|null} - Summary string or null
 */
export function buildUserHistorySummary(submissions) {
  if (!submissions || submissions.length === 0) {
    return null;
  }

  const total = submissions.length;
  const accepted = submissions.filter((s) => s.status === "accepted").length;
  const wrongAnswer = submissions.filter(
    (s) => s.status === "wrong_answer",
  ).length;
  const tle = submissions.filter(
    (s) => s.status === "time_limit_exceeded",
  ).length;
  const runtimeError = submissions.filter(
    (s) => s.status === "runtime_error",
  ).length;
  const compileError = submissions.filter(
    (s) => s.status === "compile_error",
  ).length;

  // Find common problem categories/tags from failed submissions
  const failedSubmissions = submissions.filter((s) => s.status !== "accepted");

  let summary = `Recent ${total} submissions: ${accepted} accepted, ${total - accepted} failed.`;

  if (wrongAnswer > 0) summary += ` Wrong answers: ${wrongAnswer}.`;
  if (tle > 0) summary += ` TLE: ${tle}.`;
  if (runtimeError > 0) summary += ` Runtime errors: ${runtimeError}.`;
  if (compileError > 0) summary += ` Compile errors: ${compileError}.`;

  return summary;
}

/**
 * Request AI feedback for a submission
 * @param {Object} params - Submission context
 * @param {string} params.userId - User ID
 * @param {string} params.problemId - Question/Problem ID
 * @param {string} params.problemCategory - Category/tags of the problem
 * @param {string} params.constraints - Problem constraints
 * @param {string} params.code - Submitted code
 * @param {string} params.language - Programming language
 * @param {string} params.verdict - Submission verdict (backend format)
 * @param {string|null} params.userHistorySummary - User's submission history summary
 * @returns {Promise<Object|null>} - AI feedback response or null on failure
 */
export async function getAIFeedback({
  userId,
  problemId,
  problemCategory,
  constraints,
  code,
  language,
  verdict,
  userHistorySummary,
}) {
  const startTime = Date.now();
  const url = `${AI_SERVICE_URL}/ai/feedback`;

  try {
    log.info("Preparing AI request", {
      userId,
      problemId,
      verdict,
      language,
      codeLength: code?.length,
    });

    // Build the payload matching SubmissionContext schema
    const payload = {
      user_id: userId,
      problem_id: problemId,
      problem_category: problemCategory || "General",
      constraints: constraints || "No specific constraints",
      code: code,
      language: language,
      verdict: VERDICT_MAP[verdict] || verdict,
      error_type: ERROR_TYPE_MAP[verdict] || null,
      user_history_summary: userHistorySummary,
    };

    log.info(`→ POST ${url}`, {
      verdict: payload.verdict,
      error_type: payload.error_type,
    });

    const response = await axios.post(url, payload, {
      timeout: AI_TIMEOUT_MS,
      headers: {
        "Content-Type": "application/json",
      },
    });

    const duration = Date.now() - startTime;
    log.http("POST", "/ai/feedback", response.status, duration);

    log.success("AI feedback received", {
      hintCount: response.data?.hints?.length || 0,
      feedbackType: response.data?.feedback_type,
      hasExplanation: !!response.data?.explanation,
    });

    return response.data;
  } catch (error) {
    const duration = Date.now() - startTime;

    // Detailed error logging
    if (error.response) {
      log.http("POST", "/ai/feedback", error.response.status, duration);
      log.error("AI Service error response", {
        status: error.response.status,
        data: error.response.data,
      });
    } else if (error.code === "ECONNREFUSED") {
      log.error("AI Service connection refused", {
        url: AI_SERVICE_URL,
        message: "Is the AI service running?",
      });
    } else if (error.code === "ETIMEDOUT" || error.code === "ECONNABORTED") {
      log.error("AI Service timeout", {
        timeout: AI_TIMEOUT_MS,
        duration,
      });
    } else {
      log.error("AI Service request failed", {
        code: error.code,
        message: error.message,
      });
    }

    return null;
  }
}

/**
 * Check if AI service is healthy
 * @returns {Promise<boolean>}
 */
export async function checkAIServiceHealth() {
  const startTime = Date.now();
  const url = `${AI_SERVICE_URL}/health`;

  try {
    log.info(`Health check → ${url}`);
    const response = await axios.get(url, { timeout: 5000 });
    const duration = Date.now() - startTime;

    log.http("GET", "/health", response.status, duration);

    if (response.data?.status === "ok") {
      log.success("AI Service is healthy", {
        version: response.data.version,
        timestamp: response.data.timestamp,
      });
      return true;
    }

    log.warn("AI Service returned unexpected status", response.data);
    return false;
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error("Health check failed", {
      duration,
      error: error.message,
      code: error.code,
    });
    return false;
  }
}

export default {
  getAIFeedback,
  buildUserHistorySummary,
  checkAIServiceHealth,
};
