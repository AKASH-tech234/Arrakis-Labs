

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

export default {
  getAIFeedback,
  getWeeklyReport,
  checkAIServiceHealth,
};
