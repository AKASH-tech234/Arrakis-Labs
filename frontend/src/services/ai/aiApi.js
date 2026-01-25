// src/services/aiApi.js
// AI Services API Client - Strictly follows backend contract
// NO polling, NO WebSockets, NO speculative async results

const AI_SERVICE_URL =
  import.meta.env.VITE_AI_SERVICE_URL || "http://localhost:8000";

/**
 * Helper to get auth token
 */
function getAuthToken() {
  try {
    return localStorage.getItem("arrakis_token");
  } catch {
    return null;
  }
}

/**
 * Core request handler for AI service
 */
async function aiRequest(path, { method = "POST", body, signal } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${AI_SERVICE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(
      errorData.detail || `AI request failed (${response.status})`,
    );
    error.status = response.status;
    throw error;
  }

  return response.json();
}

/**
 * POST /ai/feedback
 *
 * SYNC workflow returns immediately usable UI data:
 * - explanation (from feedback_agent)
 * - improvement_hint (from feedback_agent)
 * - detected_pattern (from pattern_detection_agent, may be null)
 * - hint (from hint_agent, may be null)
 *
 * ASYNC workflow runs in background - we NEVER receive those results.
 *
 * @param {Object} params
 * @param {string} params.userId - User identifier
 * @param {string} params.problemId - Problem/question identifier
 * @param {string} params.problemCategory - Problem category (e.g., "Arrays", "DP")
 * @param {string} params.constraints - Problem constraints text
 * @param {string} params.code - User's submitted code
 * @param {string} params.language - Programming language
 * @param {string} params.verdict - Submission verdict (wrong_answer, runtime_error, etc.)
 * @param {string} [params.errorType] - Specific error type (optional)
 * @param {AbortSignal} [params.signal] - Abort signal for cancellation
 * @returns {Promise<AIFeedbackResponse>}
 */
export async function getAIFeedback({
  userId,
  problemId,
  problemCategory,
  constraints,
  code,
  language,
  verdict,
  errorType = null,
  signal,
}) {
  // Validate required fields
  if (!userId) throw new Error("userId is required");
  if (!problemId) throw new Error("problemId is required");
  if (!code) throw new Error("code is required");
  if (!language) throw new Error("language is required");
  if (!verdict) throw new Error("verdict is required");

  const payload = {
    user_id: userId,
    problem_id: problemId,
    problem_category: problemCategory || "General",
    constraints: constraints || "",
    code,
    language,
    verdict,
    error_type: errorType,
    user_history_summary: null, // Backend handles this via memory retrieval
  };

  return aiRequest("/ai/feedback", { method: "POST", body: payload, signal });
}

/**
 * POST /ai/weekly-report
 *
 * ON-DEMAND weekly report generation.
 * Only fetched when user explicitly requests it.
 *
 * ❌ Do NOT auto-fetch
 * ❌ Do NOT poll
 * ❌ Do NOT show automatically after submission
 *
 * @param {Object} params
 * @param {string} params.userId - User identifier
 * @param {AbortSignal} [params.signal] - Abort signal for cancellation
 * @returns {Promise<WeeklyReportResponse>}
 */
export async function getWeeklyReport({ userId, signal }) {
  if (!userId) throw new Error("userId is required");

  // Minimal payload - backend handles memory retrieval
  const payload = {
    user_id: userId,
    problem_id: "weekly-report-request",
    problem_category: "Report",
    constraints: "",
    code: "",
    language: "none",
    verdict: "report_request",
    error_type: null,
    user_history_summary: null,
  };

  return aiRequest("/ai/weekly-report", {
    method: "POST",
    body: payload,
    signal,
  });
}

/**
 * Health check for AI service
 * @returns {Promise<{status: string, service: string}>}
 */
export async function checkAIServiceHealth() {
  return aiRequest("/health", { method: "GET" });
}

export default {
  getAIFeedback,
  getWeeklyReport,
  checkAIServiceHealth,
};
