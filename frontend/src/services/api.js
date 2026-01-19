// src/services/api.js - Frontend API client

import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const TOKEN_KEY = "arrakis_token";

const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore
  }
};

const clearToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
};

// Axios client (used by contestApi and any axios-style consumers)
const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearToken();
      window.dispatchEvent(new CustomEvent("auth:logout"));
    }
    return Promise.reject(error);
  }
);

async function request(path, { method = "GET", body, signal } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  // Auto-clear token on 401 (expired/invalid)
  if (response.status === 401) {
    clearToken();
    // Dispatch custom event for AuthContext to catch
    window.dispatchEvent(new CustomEvent("auth:logout"));
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Request failed (${response.status})`);
  }

  return response.json().catch(() => ({}));
}

export async function getPublicQuestions({ page = 1, limit = 1000, difficulty, search } = {}) {
  const params = new URLSearchParams();
  if (page) params.set("page", String(page));
  if (limit) params.set("limit", String(limit));
  if (difficulty) params.set("difficulty", difficulty);
  if (search) params.set("search", search);

  const qs = params.toString();
  const data = await request(`/questions${qs ? `?${qs}` : ""}`, { method: "GET" });
  return {
    questions: data.data || [],
    pagination: data.pagination,
  };
}

export async function getPublicQuestion(questionId) {
  if (!questionId) throw new Error("questionId is required");
  const data = await request(`/questions/${questionId}`, { method: "GET" });
  return data.data;
}

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

  const data = await request(`/submissions${qs ? `?${qs}` : ""}`, { method: "GET" });
  return data.data || [];
}

/**
 * Execute code via the backend Piston proxy
 * @param {Object} params
 * @param {string} params.code - Source code to execute
 * @param {string} params.language - Language identifier (python, javascript, java, cpp)
 * @param {string} [params.stdin] - Optional stdin input
 * @param {AbortSignal} [params.signal] - Optional abort signal
 * @returns {Promise<{stdout: string, stderr: string, output: string, exitCode: number}>}
 */
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

export async function signup({ name, email, password, passwordConfirm }) {
  const data = await request("/auth/signup", {
    method: "POST",
    body: { name, email, password, passwordConfirm },
  });

  if (data?.token) setToken(data.token);
  return data;
}

export async function signin({ email, password }) {
  const data = await request("/auth/signin", {
    method: "POST",
    body: { email, password },
  });

  if (data?.token) setToken(data.token);
  return data;
}

export async function getMe() {
  const data = await request("/auth/me", { method: "GET" });
  return data.user;
}

export async function signout() {
  try {
    await request("/auth/logout", { method: "POST" });
  } finally {
    clearToken();
  }
}

export { clearToken };

export default apiClient;
