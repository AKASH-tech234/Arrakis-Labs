import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const clearToken = () => {
  window.dispatchEvent(new CustomEvent("auth:logout"));
};

const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// ─── Silent Refresh on 401 ──────────────────────────────────────────────────

let isRefreshing = false;
let refreshSubscribers = [];

const onRefreshed = () => {
  refreshSubscribers.forEach((cb) => cb());
  refreshSubscribers = [];
};

const addRefreshSubscriber = (cb) => {
  refreshSubscribers.push(cb);
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error?.response?.status === 401 &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          addRefreshSubscriber(() => {
            resolve(apiClient(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await axios.post(
          `${API_BASE}/auth/refresh-token`,
          {},
          { withCredentials: true }
        );

        isRefreshing = false;
        onRefreshed();
        return apiClient(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        refreshSubscribers = [];
        clearToken();
        return Promise.reject(refreshError);
      }
    }

    if (error?.response?.status === 401) {
      clearToken();
    }

    return Promise.reject(error);
  },
);

export async function getProblemDiscussions(problemId, { sort = "top", language, page = 1, limit = 20 } = {}) {
  try {
    const params = { sort, page, limit };
    if (language) params.language = language;

    const response = await apiClient.get(`/problems/${problemId}/discussions`, { params });
    return { success: true, data: response.data.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message || "Failed to load discussions",
    };
  }
}

export async function postSolution(problemId, payload) {
  try {
    const response = await apiClient.post(`/problems/${problemId}/solutions`, payload);
    return { success: true, data: response.data.data, message: response.data.message };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message || "Failed to post solution",
    };
  }
}

export async function getThreadMessages(threadId) {
  try {
    const response = await apiClient.get(`/threads/${threadId}/messages`);
    return { success: true, data: response.data.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message || "Failed to load messages",
    };
  }
}

export async function postComment(payload) {
  try {
    const response = await apiClient.post(`/discussions/comment`, payload);
    return { success: true, data: response.data.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message || "Failed to post comment",
    };
  }
}

export async function voteSolution(solutionPostId, value) {
  try {
    const response = await apiClient.post(`/solutions/${solutionPostId}/vote`, { value });
    return { success: true, data: response.data.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message || "Failed to vote",
    };
  }
}
