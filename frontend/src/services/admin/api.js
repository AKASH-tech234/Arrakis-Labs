// src/services/admin/api.js
// Admin API service - centralized admin API calls

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const ADMIN_BASE = `${API_BASE}/admin`;

/**
 * Base request function for admin API calls
 */
async function adminRequest(path, { method = "GET", body, signal } = {}) {
  const headers = { "Content-Type": "application/json" };

  const response = await fetch(`${ADMIN_BASE}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent("auth:logout"));
    throw new Error("Authentication required");
  }

  if (response.status === 403) {
    throw new Error("Insufficient permissions");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Request failed (${response.status})`);
  }

  return response.json().catch(() => ({}));
}

// ============ PROBLEM API ============

export const problemApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return adminRequest(`/problems${query ? `?${query}` : ""}`);
  },

  get: (id) => adminRequest(`/problems/${id}`),

  create: (data) =>
    adminRequest("/problems", {
      method: "POST",
      body: data,
    }),

  update: (id, data) =>
    adminRequest(`/problems/${id}`, {
      method: "PUT",
      body: data,
    }),

  delete: (id) =>
    adminRequest(`/problems/${id}`, {
      method: "DELETE",
    }),

  publish: (id) =>
    adminRequest(`/problems/${id}/publish`, {
      method: "POST",
    }),

  unpublish: (id) =>
    adminRequest(`/problems/${id}/unpublish`, {
      method: "POST",
    }),

  analyzeDifficulty: (id) =>
    adminRequest(`/problems/${id}/difficulty/analyze`, {
      method: "POST",
    }),

  // Test cases
  getTestCases: (problemId) => adminRequest(`/problems/${problemId}/testcases`),

  createTestCase: (problemId, data) =>
    adminRequest(`/problems/${problemId}/testcases`, {
      method: "POST",
      body: data,
    }),

  updateTestCase: (problemId, testCaseId, data) =>
    adminRequest(`/problems/${problemId}/testcases/${testCaseId}`, {
      method: "PUT",
      body: data,
    }),

  deleteTestCase: (problemId, testCaseId) =>
    adminRequest(`/problems/${problemId}/testcases/${testCaseId}`, {
      method: "DELETE",
    }),

  bulkCreateTestCases: (problemId, testCases) =>
    adminRequest(`/problems/${problemId}/testcases/bulk`, {
      method: "POST",
      body: { testcases: testCases },
    }),

  generateTestCases: (problemId, params) =>
    adminRequest(`/problems/${problemId}/testcases/generate`, {
      method: "POST",
      body: params,
    }),
};

// ============ CONTEST API ============

export const contestApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return adminRequest(`/contests${query ? `?${query}` : ""}`);
  },

  get: (id) => adminRequest(`/contests/${id}`),

  create: (data) =>
    adminRequest("/contests", {
      method: "POST",
      body: data,
    }),

  update: (id, data) =>
    adminRequest(`/contests/${id}`, {
      method: "PUT",
      body: data,
    }),

  delete: (id) =>
    adminRequest(`/contests/${id}`, {
      method: "DELETE",
    }),

  publish: (id) =>
    adminRequest(`/contests/${id}/publish`, {
      method: "POST",
    }),

  cancel: (id, reason) =>
    adminRequest(`/contests/${id}/cancel`, {
      method: "POST",
      body: { reason },
    }),

  extend: (id, additionalMinutes) =>
    adminRequest(`/contests/${id}/extend`, {
      method: "POST",
      body: { additionalMinutes },
    }),

  // Contest problems
  getProblems: (contestId) => adminRequest(`/contests/${contestId}/problems`),

  addProblem: (contestId, problemId, data) =>
    adminRequest(`/contests/${contestId}/problems`, {
      method: "POST",
      body: { problemId, ...data },
    }),

  removeProblem: (contestId, problemId) =>
    adminRequest(`/contests/${contestId}/problems/${problemId}`, {
      method: "DELETE",
    }),

  reorderProblems: (contestId, orderedIds) =>
    adminRequest(`/contests/${contestId}/problems/reorder`, {
      method: "PUT",
      body: { orderedIds },
    }),
};

// ============ SUBMISSION API ============

export const submissionApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return adminRequest(`/submissions${query ? `?${query}` : ""}`);
  },

  get: (id) => adminRequest(`/submissions/${id}`),

  rejudge: (id) =>
    adminRequest(`/submissions/${id}/rejudge`, {
      method: "POST",
    }),

  bulkRejudge: (ids) =>
    adminRequest("/submissions/rejudge", {
      method: "POST",
      body: { ids },
    }),
};

// ============ LEADERBOARD API ============

export const leaderboardApi = {
  get: (contestId) => adminRequest(`/leaderboards/${contestId}`),

  freeze: (contestId) =>
    adminRequest(`/leaderboards/${contestId}/freeze`, {
      method: "POST",
    }),

  unfreeze: (contestId) =>
    adminRequest(`/leaderboards/${contestId}/unfreeze`, {
      method: "POST",
    }),

  recalculate: (contestId) =>
    adminRequest(`/leaderboards/${contestId}/recalculate`, {
      method: "POST",
    }),

  adjustScore: (contestId, userId, adjustment, reason) =>
    adminRequest(`/leaderboards/${contestId}/entries/${userId}`, {
      method: "PUT",
      body: { scoreAdjustment: adjustment, reason },
    }),

  hideUser: (contestId, userId, hide) =>
    adminRequest(`/leaderboards/${contestId}/entries/${userId}`, {
      method: "PUT",
      body: { hide },
    }),
};

// ============ PLAGIARISM API ============

export const plagiarismApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return adminRequest(`/plagiarism${query ? `?${query}` : ""}`);
  },

  get: (id) => adminRequest(`/plagiarism/${id}`),

  decide: (id, decision) =>
    adminRequest(`/plagiarism/${id}/decision`, {
      method: "PUT",
      body: decision,
    }),

  runDetection: (params = {}) =>
    adminRequest("/plagiarism/run", {
      method: "POST",
      body: params,
    }),
};

// ============ USER API ============

export const userApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return adminRequest(`/users${query ? `?${query}` : ""}`);
  },

  get: (id) => adminRequest(`/users/${id}`),

  update: (id, data) =>
    adminRequest(`/users/${id}`, {
      method: "PUT",
      body: data,
    }),

  warn: (id, reason, severity) =>
    adminRequest(`/users/${id}/warn`, {
      method: "POST",
      body: { reason, severity },
    }),

  suspend: (id, duration, reason) =>
    adminRequest(`/users/${id}/suspend`, {
      method: "POST",
      body: { duration, reason },
    }),

  ban: (id, reason, permanent = true) =>
    adminRequest(`/users/${id}/ban`, {
      method: "POST",
      body: { reason, permanent },
    }),

  unban: (id) =>
    adminRequest(`/users/${id}/unban`, {
      method: "POST",
    }),

  resetPassword: (id) =>
    adminRequest(`/users/${id}/reset-password`, {
      method: "POST",
    }),
};

// ============ ROLES API ============

export const rolesApi = {
  list: () => adminRequest("/roles"),

  get: (id) => adminRequest(`/roles/${id}`),

  create: (data) =>
    adminRequest("/roles", {
      method: "POST",
      body: data,
    }),

  update: (id, data) =>
    adminRequest(`/roles/${id}`, {
      method: "PUT",
      body: data,
    }),

  delete: (id) =>
    adminRequest(`/roles/${id}`, {
      method: "DELETE",
    }),

  getPermissions: () => adminRequest("/permissions"),

  updatePermissions: (roleId, permissions) =>
    adminRequest(`/roles/${roleId}/permissions`, {
      method: "PUT",
      body: { permissions },
    }),
};

// ============ SYSTEM API ============

export const systemApi = {
  getHealth: () => adminRequest("/system/health"),

  getWorkers: () => adminRequest("/system/workers"),

  restartWorker: (workerId) =>
    adminRequest(`/system/workers/${workerId}/restart`, {
      method: "POST",
    }),

  getQueues: () => adminRequest("/system/queues"),

  clearQueue: (queueName) =>
    adminRequest(`/system/queues/${queueName}/clear`, {
      method: "POST",
    }),
};

// ============ CONFIG API ============

export const configApi = {
  getJudgeConfig: () => adminRequest("/config/judge"),

  updateJudgeConfig: (config) =>
    adminRequest("/config/judge", {
      method: "PUT",
      body: config,
    }),

  getLanguages: () => adminRequest("/config/languages"),

  updateLanguage: (id, config) =>
    adminRequest(`/config/languages/${id}`, {
      method: "PUT",
      body: config,
    }),
};

// ============ AUDIT API ============

export const auditApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return adminRequest(`/system/audit${query ? `?${query}` : ""}`);
  },

  get: (id) => adminRequest(`/system/audit/${id}`),
};

export default {
  problem: problemApi,
  contest: contestApi,
  submission: submissionApi,
  leaderboard: leaderboardApi,
  plagiarism: plagiarismApi,
  user: userApi,
  roles: rolesApi,
  system: systemApi,
  config: configApi,
  audit: auditApi,
};
