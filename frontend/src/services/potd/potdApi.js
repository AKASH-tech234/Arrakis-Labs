import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

export const getTodaysPOTD = async () => {
  try {
    const response = await apiClient.get("/potd/today");
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    console.error("Error fetching today's POTD:", error);
    return {
      success: false,
      error: error.response?.data?.message || "Failed to fetch POTD",
    };
  }
};

export const getUserStreak = async () => {
  try {
    const response = await apiClient.get("/potd/streak");
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    console.error("Error fetching user streak:", error);
    return {
      success: false,
      error: error.response?.data?.message || "Failed to fetch streak",
    };
  }
};

export const getUserPOTDCalendar = async (year, month) => {
  try {

    const params = {};
    const arg1IsDateLike = typeof year === "string";
    const arg2IsDateLike = typeof month === "string";

    if (arg1IsDateLike && arg2IsDateLike) {
      params.startDate = year;
      params.endDate = month;
    } else {
      if (year) params.year = year;
      if (month) params.month = month;
    }

    const response = await apiClient.get("/potd/calendar", { params });
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    console.error("Error fetching POTD calendar:", error);
    return {
      success: false,
      error: error.response?.data?.message || "Failed to fetch calendar",
    };
  }
};

export const getScheduledPOTDs = async ({ month, year, startDate, endDate } = {}) => {
  try {
    const params = {};
    if (month) params.month = month;
    if (year) params.year = year;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    const response = await apiClient.get("/admin/potd/schedule", { params });
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    console.error("Error fetching scheduled POTDs:", error);
    return {
      success: false,
      error: error.response?.data?.message || "Failed to fetch schedules",
    };
  }
};

export const getAvailableProblems = async ({ search, difficulty, tags, page, limit } = {}) => {
  try {
    const params = {};
    if (search) params.search = search;
    if (difficulty) params.difficulty = difficulty;
    if (tags) params.tags = tags;
    if (page) params.page = page;
    if (limit) params.limit = limit;

    const response = await apiClient.get("/admin/potd/available-problems", { params });
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    console.error("Error fetching available problems:", error);
    return {
      success: false,
      error: error.response?.data?.message || "Failed to fetch problems",
    };
  }
};

export const schedulePOTD = async (problemId, scheduledDate, notes = "") => {
  try {
    const response = await apiClient.post("/admin/potd/schedule", {
      problemId,
      scheduledDate,
      notes,
    });
    return {
      success: true,
      data: response.data.data,
      message: response.data.message,
    };
  } catch (error) {
    console.error("Error scheduling POTD:", error);
    return {
      success: false,
      error: error.response?.data?.message || "Failed to schedule POTD",
    };
  }
};

export const deleteScheduledPOTD = async (scheduleId) => {
  try {
    const response = await apiClient.delete(`/admin/potd/schedule/${scheduleId}`);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error("Error deleting scheduled POTD:", error);
    return {
      success: false,
      error: error.response?.data?.message || "Failed to delete schedule",
    };
  }
};

export const forcePublishPOTD = async () => {
  try {
    const response = await apiClient.post("/admin/potd/force-publish");
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    console.error("Error force publishing POTD:", error);
    return {
      success: false,
      error: error.response?.data?.message || "Failed to force publish",
    };
  }
};

export const recordPOTDAttempt = async (potdId, submissionId) => {
  try {
    const response = await apiClient.post("/potd/attempt", {
      potdId,
      submissionId,
    });
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    console.error("Error recording POTD attempt:", error);
    return {
      success: false,
      error: error.response?.data?.message || "Failed to record attempt",
    };
  }
};

export const solvePOTD = async (potdId, submissionId) => {
  try {
    const response = await apiClient.post("/potd/solve", {
      potdId,
      submissionId,
    });
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    console.error("Error solving POTD:", error);
    return {
      success: false,
      error: error.response?.data?.message || "Failed to mark as solved",
    };
  }
};

export const getPOTDHistory = async (limit = 30, page = 1) => {
  try {
    const response = await apiClient.get("/potd/history", {
      params: { limit, page },
    });
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    console.error("Error fetching POTD history:", error);
    return {
      success: false,
      error: error.response?.data?.message || "Failed to fetch history",
    };
  }
};

export const getStreakLeaderboard = async (limit = 10) => {
  try {
    const response = await apiClient.get("/potd/leaderboard", {
      params: { limit },
    });
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    console.error("Error fetching streak leaderboard:", error);
    return {
      success: false,
      error: error.response?.data?.message || "Failed to fetch leaderboard",
    };
  }
};

export const getSchedulerStatus = async () => {
  try {
    
    const response = await apiClient.get("/admin/potd/scheduler-status");
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    console.error("Error fetching scheduler status:", error);
    return {
      success: false,
      error: error.response?.data?.message || "Failed to fetch status",
    };
  }
};

export default {
  getTodaysPOTD,
  getUserStreak,
  getUserPOTDCalendar,
  recordPOTDAttempt,
  solvePOTD,
  getPOTDHistory,
  getStreakLeaderboard,
  getSchedulerStatus,
  getScheduledPOTDs,
  getAvailableProblems,
  schedulePOTD,
  deleteScheduledPOTD,
  forcePublishPOTD,
};
