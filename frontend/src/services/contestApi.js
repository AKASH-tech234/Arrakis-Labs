import api from "./api";
import { leetCodeConstraints } from "../lib/leetcodeConstraints";

/**
 * Contest API Service
 * Handles all contest-related API calls
 */

const contestApi = {
  // ==========================================
  // PUBLIC ENDPOINTS
  // ==========================================

  /**
   * Get all contests
   * @param {Object} params - { status, page, limit }
   */
  getContests: async (params = {}) => {
    const response = await api.get("/contests", { params });
    const data = response.data;

    // Format any nested problem constraints before returning
    if (Array.isArray(data?.data)) {
      data.data = data.data.map((contest) => {
        if (Array.isArray(contest.problems)) {
          contest.problems = contest.problems.map((p) => ({
            ...p,
            constraints: leetCodeConstraints(p.constraints),
          }));
        }
        return contest;
      });
    }

    return data;
  },

  /**
   * Get single contest details
   * @param {string} contestId - Contest ID or slug
   */
  getContest: async (contestId) => {
    const response = await api.get(`/contests/${contestId}`);
    const data = response.data?.data || response.data;

    // If contest includes problems, format their constraints
    if (data && Array.isArray(data.problems)) {
      data.problems = data.problems.map((p) => ({
        ...p,
        constraints: leetCodeConstraints(p.constraints),
      }));
    }

    return response.data;
  },

  /**
   * Get contest leaderboard
   * @param {string} contestId
   * @param {Object} params - { page, limit }
   */
  getLeaderboard: async (contestId, params = {}) => {
    const response = await api.get(
      `/contests/${contestId}/leaderboard`,
      { params },
    );
    return response.data;
  },

  // ==========================================
  // PROTECTED ENDPOINTS (require auth)
  // ==========================================

  /**
   * Register for a contest
   * @param {string} contestId
   */
  registerForContest: async (contestId) => {
    const response = await api.post(
      `/contests/${contestId}/register`,
    );
    return response.data;
  },

  /**
   * Join a contest (start participating)
   * @param {string} contestId
   */
  joinContest: async (contestId) => {
    const response = await api.post(`/contests/${contestId}/join`);
    return response.data;
  },

  /**
   * Get contest problem details (🔥 LeetCode constraints applied)
   * @param {string} contestId
   * @param {string} problemId
   */
  getContestProblem: async (contestId, problemId) => {
    const response = await api.get(
      `/contests/${contestId}/problems/${problemId}`,
    );

    const problem = response.data?.data || response.data;

    return {
      ...problem,
      constraints: leetCodeConstraints(problem.constraints),
    };
  },

  /**
   * Run code (visible test cases only)
   * @param {string} contestId
   * @param {Object} data - { problemId, code, language }
   */
  runCode: async (contestId, data) => {
    const response = await api.post(
      `/contests/${contestId}/run`,
      data,
    );
    return response.data;
  },

  /**
   * Submit code (all test cases)
   * @param {string} contestId
   * @param {Object} data - { problemId, code, language }
   */
  submitCode: async (contestId, data) => {
    const response = await api.post(
      `/contests/${contestId}/submit`,
      data,
    );
    return response.data;
  },

  /**
   * Get user's submissions for a contest
   * @param {string} contestId
   * @param {string} problemId - Optional
   */
  getSubmissions: async (contestId, problemId = null) => {
    const params = problemId ? { problemId } : {};
    const response = await api.get(
      `/contests/${contestId}/submissions`,
      { params },
    );
    return response.data;
  },

  /**
   * Get specific submission details
   * @param {string} contestId
   * @param {string} submissionId
   */
  getSubmission: async (contestId, submissionId) => {
    const response = await api.get(
      `/contests/${contestId}/submissions/${submissionId}`,
    );
    return response.data;
  },

  /**
   * Get user's standing/rank
   * @param {string} contestId
   */
  getUserStanding: async (contestId) => {
    const response = await api.get(
      `/contests/${contestId}/standing`,
    );
    return response.data;
  },

  /**
   * Get user's analytics (post-contest)
   * @param {string} contestId
   */
  getAnalytics: async (contestId) => {
    const response = await api.get(
      `/contests/${contestId}/analytics`,
    );
    return response.data;
  },
};

export default contestApi;
