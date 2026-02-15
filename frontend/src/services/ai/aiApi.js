import logger from "../../utils/logger";

const AI_SERVICE_URL =
  import.meta.env.VITE_AI_SERVICE_URL || "http://localhost:8000";

function getAuthToken() {
  try {
    return localStorage.getItem("arrakis_token");
  } catch {
    return null;
  }
}

async function aiRequest(path, { method = "POST", body, signal } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${AI_SERVICE_URL}${path}`;
  logger.log(`[AI API] ${method} ${url}`, body ? { body } : "");

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    logger.error(`[AI API] Error ${response.status}:`, errorData);
    const error = new Error(
      errorData.detail || `AI request failed (${response.status})`,
    );
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  logger.log(`[AI API] Response from ${path}:`, data);
  return data;
}

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
    user_history_summary: null,
  };

  return aiRequest("/ai/feedback", { method: "POST", body: payload, signal });
}

export async function getWeeklyReport({ userId, signal }) {
  if (!userId) throw new Error("userId is required");

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

export async function checkAIServiceHealth() {
  return aiRequest("/health", { method: "GET" });
}

export async function getMIMStatus() {
  return aiRequest("/ai/mim/status", { method: "GET" });
}

export async function getMIMProfile({ userId, signal }) {
  if (!userId) throw new Error("userId is required");
  return aiRequest(`/ai/mim/profile/${encodeURIComponent(userId)}`, {
    method: "GET",
    signal,
  });
}

export async function getMIMRecommendations({ userId, limit = 5, signal }) {
  if (!userId) throw new Error("userId is required");
  const url = `/ai/mim/recommend/${encodeURIComponent(userId)}?limit=${limit}`;
  return aiRequest(url, { method: "GET", signal });
}

export async function getMIMPrediction({ userId, problemId, signal }) {
  if (!userId) throw new Error("userId is required");
  if (!problemId) throw new Error("problemId is required");
  const url = `/ai/mim/predict/${encodeURIComponent(userId)}/${encodeURIComponent(problemId)}`;
  return aiRequest(url, { method: "GET", signal });
}

export async function getMIMRoadmap({ userId, regenerate = false, signal }) {
  if (!userId) throw new Error("userId is required");
  const url = `/ai/mim/roadmap/${encodeURIComponent(userId)}?regenerate=${regenerate}`;
  return aiRequest(url, { method: "GET", signal });
}

export async function getMIMDifficulty({ userId, signal }) {
  if (!userId) throw new Error("userId is required");
  const url = `/ai/mim/difficulty/${encodeURIComponent(userId)}`;
  return aiRequest(url, { method: "GET", signal });
}

export default {
  getAIFeedback,
  getWeeklyReport,
  checkAIServiceHealth,

  getMIMStatus,
  getMIMProfile,
  getMIMRecommendations,
  getMIMPrediction,
  getMIMRoadmap,
  getMIMDifficulty,
};
