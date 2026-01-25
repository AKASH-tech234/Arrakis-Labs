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

  const url = `${AI_SERVICE_URL}${path}`;
  console.log(`[AI API] ${method} ${url}`, body ? { body } : "");

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error(`[AI API] Error ${response.status}:`, errorData);
    const error = new Error(
      errorData.detail || `AI request failed (${response.status})`,
    );
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  console.log(`[AI API] Response from ${path}:`, data);
  return data;
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

// ═══════════════════════════════════════════════════════════════════════════════
// MIM (Misconception Identification Model) API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /ai/mim/status
 * Get MIM model status and health
 * @returns {Promise<MIMStatusResponse>}
 */
export async function getMIMStatus() {
  return aiRequest("/ai/mim/status", { method: "GET" });
}

/**
 * GET /ai/mim/profile/:userId
 * Get user's cognitive profile from MIM
 * @param {Object} params
 * @param {string} params.userId - User identifier
 * @param {AbortSignal} [params.signal] - Abort signal for cancellation
 * @returns {Promise<MIMProfileResponse>}
 */
export async function getMIMProfile({ userId, signal }) {
  if (!userId) throw new Error("userId is required");
  return aiRequest(`/ai/mim/profile/${encodeURIComponent(userId)}`, {
    method: "GET",
    signal,
  });
}

/**
 * GET /ai/mim/recommend/:userId
 * Get personalized problem recommendations from MIM
 * @param {Object} params
 * @param {string} params.userId - User identifier
 * @param {number} [params.limit=5] - Number of recommendations
 * @param {AbortSignal} [params.signal] - Abort signal for cancellation
 * @returns {Promise<MIMRecommendationsResponse>}
 */
export async function getMIMRecommendations({ userId, limit = 5, signal }) {
  if (!userId) throw new Error("userId is required");
  const url = `/ai/mim/recommend/${encodeURIComponent(userId)}?limit=${limit}`;
  return aiRequest(url, { method: "GET", signal });
}

/**
 * GET /ai/mim/predict/:userId/:problemId
 * Get pre-submission prediction for a user on a specific problem
 * @param {Object} params
 * @param {string} params.userId - User identifier
 * @param {string} params.problemId - Problem identifier
 * @param {AbortSignal} [params.signal] - Abort signal for cancellation
 * @returns {Promise<MIMPredictionResponse>}
 */
export async function getMIMPrediction({ userId, problemId, signal }) {
  if (!userId) throw new Error("userId is required");
  if (!problemId) throw new Error("problemId is required");
  const url = `/ai/mim/predict/${encodeURIComponent(userId)}/${encodeURIComponent(problemId)}`;
  return aiRequest(url, { method: "GET", signal });
}

/**
 * GET /ai/mim/roadmap/:userId
 * Get personalized learning roadmap from MIM V2.1
 * @param {Object} params
 * @param {string} params.userId - User identifier
 * @param {boolean} [params.regenerate=false] - Force regeneration
 * @param {AbortSignal} [params.signal] - Abort signal for cancellation
 * @returns {Promise<MIMRoadmapResponse>}
 */
export async function getMIMRoadmap({ userId, regenerate = false, signal }) {
  if (!userId) throw new Error("userId is required");
  const url = `/ai/mim/roadmap/${encodeURIComponent(userId)}?regenerate=${regenerate}`;
  return aiRequest(url, { method: "GET", signal });
}

/**
 * GET /ai/mim/difficulty/:userId
 * Get personalized difficulty adjustment recommendation from MIM V2.1
 * @param {Object} params
 * @param {string} params.userId - User identifier
 * @param {AbortSignal} [params.signal] - Abort signal for cancellation
 * @returns {Promise<MIMDifficultyResponse>}
 */
export async function getMIMDifficulty({ userId, signal }) {
  if (!userId) throw new Error("userId is required");
  const url = `/ai/mim/difficulty/${encodeURIComponent(userId)}`;
  return aiRequest(url, { method: "GET", signal });
}

export default {
  getAIFeedback,
  getWeeklyReport,
  checkAIServiceHealth,
  // MIM APIs
  getMIMStatus,
  getMIMProfile,
  getMIMRecommendations,
  getMIMPrediction,
  getMIMRoadmap,
  getMIMDifficulty,
};
