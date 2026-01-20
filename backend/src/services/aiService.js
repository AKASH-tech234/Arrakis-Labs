import axios from "axios";

/**
 * AI Service Client
 * Handles communication with the FastAPI AI service
 */

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const AI_TIMEOUT_MS = 60000; // 60 seconds for AI processing

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
  try {
    console.log(
      `[AI Service] Requesting feedback for user ${userId}, problem ${problemId}`,
    );

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

    console.log(`[AI Service] Payload:`, {
      user_id: payload.user_id,
      problem_id: payload.problem_id,
      problem_category: payload.problem_category,
      verdict: payload.verdict,
      error_type: payload.error_type,
      code_length: payload.code?.length,
    });

    const response = await axios.post(
      `${AI_SERVICE_URL}/ai/feedback`,
      payload,
      {
        timeout: AI_TIMEOUT_MS,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    console.log(`[AI Service] Success - received feedback`);
    return response.data;
  } catch (error) {
    // Log error but don't fail the submission
    if (error.response) {
      console.error(
        `[AI Service] Error ${error.response.status}:`,
        error.response.data,
      );
    } else if (error.code === "ECONNREFUSED") {
      console.error(
        `[AI Service] Connection refused - is the AI service running at ${AI_SERVICE_URL}?`,
      );
    } else if (error.code === "ETIMEDOUT" || error.code === "ECONNABORTED") {
      console.error(`[AI Service] Request timed out after ${AI_TIMEOUT_MS}ms`);
    } else {
      console.error(`[AI Service] Error:`, error.message);
    }

    return null;
  }
}

/**
 * Check if AI service is healthy
 * @returns {Promise<boolean>}
 */
export async function checkAIServiceHealth() {
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/health`, {
      timeout: 5000,
    });
    return response.data?.status === "ok";
  } catch (error) {
    console.error(`[AI Service] Health check failed:`, error.message);
    return false;
  }
}

export default {
  getAIFeedback,
  buildUserHistorySummary,
  checkAIServiceHealth,
};
