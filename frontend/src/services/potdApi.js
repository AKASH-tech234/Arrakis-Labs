import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

/**
 * POTD API Service
 * Handles all Problem of the Day related API calls
 */

// Axios client with credentials
const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

/**
 * Get today's Problem of the Day
 * @returns {Promise<{success: boolean, data: object}>}
 */
export const getTodaysPOTD = async () => {
  try {
    const response = await apiClient.get("/potd/today");
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error("Error fetching today's POTD:", error);
    return {
      success: false,
      error: error.response?.data?.message || "Failed to fetch POTD",
    };
  }
};

/**
 * Get user's current streak information
 * @returns {Promise<{success: boolean, data: object}>}
 */
export const getUserStreak = async () => {
  try {
    const response = await apiClient.get("/potd/streak");
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error("Error fetching user streak:", error);
    return {
      success: false,
      error: error.response?.data?.message || "Failed to fetch streak",
    };
  }
};

/**
 * Get user's POTD calendar (solved/missed days)
 * @param {number} year - Optional year filter
 * @param {number} month - Optional month filter (1-12)
 * @returns {Promise<{success: boolean, data: object}>}
 */
export const getUserPOTDCalendar = async (year, month) => {
  try {
    const params = {};
    if (year) params.year = year;
    if (month) params.month = month;

    const response = await apiClient.get("/potd/calendar", { params });
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error("Error fetching POTD calendar:", error);
    return {
      success: false,
      error: error.response?.data?.message || "Failed to fetch calendar",
    };
  }
};

/**
 * Record an attempt on today's POTD
 * @param {string} potdId - The POTD ID
 * @param {string} submissionId - The submission ID
 * @returns {Promise<{success: boolean, data: object}>}
 */
export const recordPOTDAttempt = async (potdId, submissionId) => {
  try {
    const response = await apiClient.post("/potd/attempt", {
      potdId,
      submissionId,
    });
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error("Error recording POTD attempt:", error);
    return {
      success: false,
      error: error.response?.data?.message || "Failed to record attempt",
    };
  }
};

/**
 * Mark POTD as solved
 * @param {string} potdId - The POTD ID
 * @param {string} submissionId - The successful submission ID
 * @returns {Promise<{success: boolean, data: object}>}
 */
export const solvePOTD = async (potdId, submissionId) => {
  try {
    const response = await apiClient.post("/potd/solve", {
      potdId,
      submissionId,
    });
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error("Error solving POTD:", error);
    return {
      success: false,
      error: error.response?.data?.message || "Failed to mark as solved",
    };
  }
};

/**
 * Get POTD history (past problems)
 * @param {number} limit - Number of past POTDs to fetch
 * @param {number} page - Page number for pagination
 * @returns {Promise<{success: boolean, data: object}>}
 */
export const getPOTDHistory = async (limit = 30, page = 1) => {
  try {
    const response = await apiClient.get("/potd/history", {
      params: { limit, page },
    });
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error("Error fetching POTD history:", error);
    return {
      success: false,
      error: error.response?.data?.message || "Failed to fetch history",
    };
  }
};

/**
 * Get streak leaderboard
 * @param {number} limit - Number of users to fetch
 * @returns {Promise<{success: boolean, data: object}>}
 */
export const getStreakLeaderboard = async (limit = 10) => {
  try {
    const response = await apiClient.get("/potd/leaderboard", {
      params: { limit },
    });
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error("Error fetching streak leaderboard:", error);
    return {
      success: false,
      error: error.response?.data?.message || "Failed to fetch leaderboard",
    };
  }
};

/**
 * Get POTD scheduler status (debug)
 * @returns {Promise<{success: boolean, data: object}>}
 */
export const getSchedulerStatus = async () => {
  try {
    const response = await apiClient.get("/potd/status");
    return {
      success: true,
      data: response.data,
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
};
