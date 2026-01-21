import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Create axios instance for admin API
const adminApi = axios.create({
  baseURL: `${API_BASE_URL}/admin`,
  withCredentials: true,
  headers: {
    Accept: "application/json",
  },
});

// Add auth token to requests
adminApi.interceptors.request.use(
  (config) => {
    // IMPORTANT: Let the browser set the multipart boundary for FormData.
    // Setting Content-Type manually can result in req.file being undefined on the server.
    if (config.data instanceof FormData) {
      if (typeof config.headers?.delete === "function") {
        config.headers.delete("Content-Type");
      } else {
        delete config.headers["Content-Type"];
      }
    } else {
      if (typeof config.headers?.set === "function") {
        config.headers.set("Content-Type", "application/json");
      } else {
        config.headers["Content-Type"] = "application/json";
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 responses (auto-logout)
adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = "/admin/login";
    }
    return Promise.reject(error);
  }
);

// ==========================================
// AUTH
// ==========================================
export const adminLogin = async (email, password) => {
  const response = await adminApi.post("/login", { email, password });
  return response.data;
};

export const adminLogout = async () => {
  try {
    await adminApi.post("/logout");
  } finally {
    // cookie-based auth; nothing to clear client-side
  }
};

export const getAdminProfile = async () => {
  const response = await adminApi.get("/profile");
  return response.data;
};

// ==========================================
// DASHBOARD
// ==========================================
export const getDashboardStats = async () => {
  const response = await adminApi.get("/dashboard");
  return response.data;
};

// ==========================================
// QUESTIONS
// ==========================================
export const getQuestions = async (params = {}) => {
  const response = await adminApi.get("/questions", { params });
  return response.data;
};

export const getQuestionById = async (id) => {
  const response = await adminApi.get(`/questions/${id}`);
  return response.data;
};

export const createQuestion = async (data) => {
  const response = await adminApi.post("/questions", data);
  return response.data;
};

export const updateQuestion = async (id, data) => {
  const response = await adminApi.put(`/questions/${id}`, data);
  return response.data;
};

export const deleteQuestion = async (id) => {
  const response = await adminApi.delete(`/questions/${id}`);
  return response.data;
};

// ==========================================
// TEST CASES
// ==========================================
export const getTestCases = async (questionId) => {
  const response = await adminApi.get(`/questions/${questionId}/test-cases`);
  return response.data;
};

export const createTestCase = async (questionId, data) => {
  const response = await adminApi.post(`/questions/${questionId}/test-cases`, data);
  return response.data;
};

export const updateTestCase = async (testCaseId, data) => {
  const response = await adminApi.put(`/test-cases/${testCaseId}`, data);
  return response.data;
};

export const deleteTestCase = async (testCaseId) => {
  const response = await adminApi.delete(`/test-cases/${testCaseId}`);
  return response.data;
};

export const toggleTestCaseHidden = async (testCaseId) => {
  const response = await adminApi.patch(`/test-cases/${testCaseId}/toggle-hidden`);
  return response.data;
};

// ==========================================
// CSV UPLOAD
// ==========================================
export const previewCSV = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  
  const response = await adminApi.post("/preview-csv", formData);
  return response.data;
};

export const uploadCSV = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  
  const response = await adminApi.post("/upload-csv", formData);
  return response.data;
};

// ==========================================
// AUDIT LOGS (Super Admin only)
// ==========================================
export const getAuditLogs = async (params = {}) => {
  const response = await adminApi.get("/audit-logs", { params });
  return response.data;
};

export default adminApi;
