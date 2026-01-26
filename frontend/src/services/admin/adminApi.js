import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const adminApi = axios.create({
  baseURL: `${API_BASE_URL}/admin`,
  withCredentials: true,
  headers: {
    Accept: "application/json",
  },
});

adminApi.interceptors.request.use(
  (config) => {

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
  (error) => Promise.reject(error),
);

adminApi.interceptors.response.use(
  (response) => response,
  (error) => {

    if (error.response?.status === 401) {
      const isAdminRoute = window.location.pathname.startsWith('/admin');
      if (isAdminRoute) {
        console.warn("[AdminAPI] 401 Unauthorized - auth required");
      }

    }
    return Promise.reject(error);
  },
);

export const adminLogin = async (email, password) => {
  const response = await adminApi.post("/login", { email, password });
  return response.data;
};

export const adminLogout = async () => {
  try {
    await adminApi.post("/logout");
  } finally {
    
  }
};

export const getAdminProfile = async () => {
  const response = await adminApi.get("/profile");
  return response.data;
};

export const getDashboardStats = async () => {
  const response = await adminApi.get("/dashboard");
  return response.data;
};

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

export const getTestCases = async (questionId) => {
  const response = await adminApi.get(`/questions/${questionId}/test-cases`);
  return response.data;
};

export const createTestCase = async (questionId, data) => {
  const response = await adminApi.post(
    `/questions/${questionId}/test-cases`,
    data,
  );
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
  const response = await adminApi.patch(
    `/test-cases/${testCaseId}/toggle-hidden`,
  );
  return response.data;
};

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

export const getAuditLogs = async (params = {}) => {
  const response = await adminApi.get("/audit-logs", { params });
  return response.data;
};

export default adminApi;
