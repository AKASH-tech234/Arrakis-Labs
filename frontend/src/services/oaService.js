import api from "./common/api";

const oaService = {

  async checkAvailability(params = {}) {
    const response = await api.get("/oa/availability", { params });
    return response.data;
  },

  async getMetadata() {
    const response = await api.get("/oa/metadata");
    return response.data;
  },

  async createSession(config) {
    const response = await api.post("/oa/sessions", config);
    return response.data;
  },

  async getActiveSession() {
    const response = await api.get("/oa/sessions/active");
    return response.data;
  },

  async getSession(sessionId) {
    const response = await api.get(`/oa/sessions/${sessionId}`);
    return response.data;
  },

  async getQuestion(sessionId, questionId) {
    const response = await api.get(
      `/oa/sessions/${sessionId}/questions/${questionId}`
    );
    return response.data;
  },

  async submitSession(sessionId) {
    const response = await api.post(`/oa/sessions/${sessionId}/submit`);
    return response.data;
  },

  async terminateSession(sessionId, reason = "user_terminated") {
    const response = await api.post(`/oa/sessions/${sessionId}/terminate`, {
      reason,
    });
    return response.data;
  },

  async syncTimer(sessionId) {
    const response = await api.get(`/oa/sessions/${sessionId}/sync`);
    return response.data;
  },

  async getSessionHistory(page = 1, limit = 10, status) {
    const params = { page, limit };
    if (status) params.status = status;
    const response = await api.get("/oa/sessions", { params });
    return response.data;
  },

  async quickFight() {
    const response = await api.post("/oa/quick-fight");
    return response.data;
  },

  async saveAnswer(sessionId, questionId, { code, language, timeSpent }) {
    const response = await api.put(
      `/oa/sessions/${sessionId}/answers/${questionId}`,
      { code, language, timeSpent }
    );
    return response.data;
  },

  async getAnswer(sessionId, questionId) {
    const response = await api.get(
      `/oa/sessions/${sessionId}/answers/${questionId}`
    );
    return response.data;
  },

  async runCode(sessionId, questionId, { code, language }) {
    const response = await api.post(
      `/oa/sessions/${sessionId}/answers/${questionId}/run`,
      { code, language }
    );
    return response.data;
  },

  async submitAnswer(sessionId, questionId, { code, language }) {
    const response = await api.post(
      `/oa/sessions/${sessionId}/answers/${questionId}/submit`,
      { code, language }
    );
    return response.data;
  },

  async recordViolation(sessionId, type, metadata = {}) {
    const response = await api.post(
      `/oa/sessions/${sessionId}/violations`,
      { type, metadata }
    );
    return response.data;
  },

  async getViolations(sessionId) {
    const response = await api.get(
      `/oa/sessions/${sessionId}/violations`
    );
    return response.data;
  },

  async getReport(sessionId) {
    const response = await api.get(`/oa/sessions/${sessionId}/report`);
    return response.data;
  },

  async getReportAnswers(sessionId) {
    const response = await api.get(
      `/oa/sessions/${sessionId}/report/answers`
    );
    return response.data;
  },

  async getUserStats() {
    const response = await api.get("/oa/stats");
    return response.data;
  },
};

export default oaService;
