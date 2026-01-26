import api from "../common/api";
import { leetCodeConstraints } from "../../lib/leetcodeConstraints";

const contestApi = {

  getContests: async (params = {}) => {
    const response = await api.get("/contests", { params });
    const data = response.data;

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

  getContest: async (contestId) => {
    const response = await api.get(`/contests/${contestId}`);
    const data = response.data?.data || response.data;

    if (data && Array.isArray(data.problems)) {
      data.problems = data.problems.map((p) => ({
        ...p,
        constraints: leetCodeConstraints(p.constraints),
      }));
    }

    return response.data;
  },

  getLeaderboard: async (contestId, params = {}) => {
    const response = await api.get(
      `/contests/${contestId}/leaderboard`,
      { params },
    );
    return response.data;
  },

  registerForContest: async (contestId) => {
    const response = await api.post(
      `/contests/${contestId}/register`,
    );
    return response.data;
  },

  joinContest: async (contestId) => {
    const response = await api.post(`/contests/${contestId}/join`);
    return response.data;
  },

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

  runCode: async (contestId, data) => {
    const response = await api.post(
      `/contests/${contestId}/run`,
      data,
    );
    return response.data;
  },

  submitCode: async (contestId, data) => {
    const response = await api.post(
      `/contests/${contestId}/submit`,
      data,
    );
    return response.data;
  },

  getSubmissions: async (contestId, problemId = null) => {
    const params = problemId ? { problemId } : {};
    const response = await api.get(
      `/contests/${contestId}/submissions`,
      { params },
    );
    return response.data;
  },

  getSubmission: async (contestId, submissionId) => {
    const response = await api.get(
      `/contests/${contestId}/submissions/${submissionId}`,
    );
    return response.data;
  },

  getUserStanding: async (contestId) => {
    const response = await api.get(
      `/contests/${contestId}/standing`,
    );
    return response.data;
  },

  getAnalytics: async (contestId) => {
    const response = await api.get(
      `/contests/${contestId}/analytics`,
    );
    return response.data;
  },
};

export default contestApi;
