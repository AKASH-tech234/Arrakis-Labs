import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

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
