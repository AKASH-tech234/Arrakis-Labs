import axios from "axios";
import { leetCodeConstraints } from "../lib/leetcodeConstraints";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Cookie-based auth
const clearToken = () => {
  window.dispatchEvent(new CustomEvent("auth:logout"));
};

// Axios client
const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => config);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearToken();
    }
    return Promise.reject(error);
  },
);

async function request(path, { method = "GET", body, signal } = {}) {
  const headers = { "Content-Type": "application/json" };

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  if (response.status === 401) {
    clearToken();
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Request failed (${response.status})`);
  }

  return response.json().catch(() => ({}));
}

/* ======================================================
   QUESTIONS (🔥 LEETCODE CONSTRAINTS APPLIED HERE)
====================================================== */

export async function getPublicQuestions({
  page = 1,
  limit = 1000,
  difficulty,
  search,
} = {}) {
  const params = new URLSearchParams();
  if (page) params.set("page", String(page));
  if (limit) params.set("limit", String(limit));
  if (difficulty) params.set("difficulty", difficulty);
  if (search) params.set("search", search);

  const qs = params.toString();
  const data = await request(`/questions${qs ? `?${qs}` : ""}`);

  // Safely parse constraints using leetCodeConstraints (keeps original on error)
  const questions = (data.data || []).map((q) => {
    let constraintsOut = q.constraints || [];
    try {
      if (Array.isArray(q.constraints)) {
        constraintsOut = leetCodeConstraints(q.constraints);
      } else if (typeof q.constraints === "string") {
        constraintsOut = leetCodeConstraints([q.constraints]);
      }
    } catch (err) {
      console.error("Constraint parsing failed for question:", q.id, err);
      constraintsOut = q.constraints || [];
    }

    return {
      ...q,
      constraints: constraintsOut,
    };
  });

  return {
    questions,
    pagination: data.pagination,
  };
}

export async function getPublicQuestion(questionId) {
  if (!questionId) throw new Error("questionId is required");

  const data = await request(`/questions/${questionId}`);

  // Safely parse constraints for single question
  let constraintsOut = data.data?.constraints || [];
  try {
    if (Array.isArray(data.data?.constraints)) {
      constraintsOut = leetCodeConstraints(data.data.constraints);
    } else if (typeof data.data?.constraints === "string") {
      constraintsOut = leetCodeConstraints([data.data.constraints]);
    }
  } catch (err) {
    console.error("Constraint parsing failed for question detail:", data.data?.id, err);
    constraintsOut = data.data?.constraints || [];
  }

  return {
    ...data.data,
    constraints: constraintsOut,
  };
}

/* ======================================================
   RUN / SUBMIT
====================================================== */

export async function runQuestion({ questionId, code, language, signal }) {
  const data = await request("/run", {
    method: "POST",
    body: { questionId, code, language },
    signal,
  });
  return data.data;
}

export async function submitQuestion({ questionId, code, language, signal }) {
  const data = await request("/submit", {
    method: "POST",
    body: { questionId, code, language },
    signal,
  });
  return data.data;
}

export async function getMySubmissions({ questionId } = {}) {
  const params = new URLSearchParams();
  if (questionId) params.set("questionId", questionId);

  const qs = params.toString();
  const data = await request(`/submissions${qs ? `?${qs}` : ""}`);
  return data.data || [];
}

/* ======================================================
   CODE EXECUTION
====================================================== */

export async function executeCode({ code, language, stdin = "", signal }) {
  const data = await request("/execute", {
    method: "POST",
    body: { code, language, stdin },
    signal,
  });

  return {
    stdout: data.stdout || "",
    stderr: data.stderr || "",
    output: data.output || "",
    exitCode: data.exitCode ?? -1,
  };
}

/* ======================================================
   AUTH
====================================================== */

export async function signup({ name, email, password, passwordConfirm }) {
  return request("/auth/signup", {
    method: "POST",
    body: { name, email, password, passwordConfirm },
  });
}

export async function signin({ email, password }) {
  return request("/auth/signin", {
    method: "POST",
    body: { email, password },
  });
}

export async function getMe() {
  const data = await request("/auth/me");
  return data.user;
}

export async function signout() {
  try {
    await request("/auth/logout", { method: "POST" });
  } finally {
    clearToken();
  }
}

export async function googleAuth(token) {
  if (!token) throw new Error("Google token is required");
  const data = await request("/auth/google", {
    method: "POST",
    body: { token },
  });
  return data;
}

/* ======================================================
   AI FEEDBACK
====================================================== */

export async function getAIFeedback({
  questionId,
  code,
  language,
  verdict,
  errorType,
  signal,
}) {
  const data = await request("/ai/feedback", {
    method: "POST",
    body: { questionId, code, language, verdict, errorType },
    signal,
  });
  return data.data;
}

export async function getAILearningSummary({
  questionId,
  code,
  language,
  signal,
}) {
  const data = await request("/ai/summary", {
    method: "POST",
    body: { questionId, code, language },
    signal,
  });
  return data.data;
}

/* ======================================================
   SUBMISSIONS
====================================================== */

export async function getSubmissionHistory({
  userId,
  limit = 50,
  signal,
} = {}) {
  const params = new URLSearchParams();
  if (userId) params.set("userId", userId);
  if (limit) params.set("limit", String(limit));

  const qs = params.toString();
  const data = await request(`/submissions${qs ? `?${qs}` : ""}`, { signal });
  return data.data || [];
}

export { clearToken };
export default apiClient;
