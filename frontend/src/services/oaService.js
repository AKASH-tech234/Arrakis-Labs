import api from "./common/api";

/**
 * OA Service - Frontend API for Online Assessment Practice
 * 
 * Error codes from backend:
 * - 400: INVALID_REQUEST - Client sent invalid data
 * - 404: NO_QUESTIONS_FOUND - No questions match criteria
 * - 409: ACTIVE_SESSION_EXISTS - User has an active session
 * - 422: INSUFFICIENT_QUESTIONS - Not enough questions available
 * - 500: SERVER_ERROR - Internal server error
 */
const oaService = {
  // ============================================
  // Pre-flight & Availability
  // ============================================

  /**
   * Check question availability before starting a session
   * Use this to prevent frustration from 404/422 errors
   * 
   * @param {Object} params - Query parameters
   * @param {string} params.difficulty - Difficulty filter (Easy/Medium/Hard/mixed)
   * @param {string} params.topics - Comma-separated topic list
   * @param {string} params.companies - Comma-separated company list
   * @param {string} params.companyMode - "all" or "selected"
   * @returns {Object} { available, byDifficulty, canStartSession, hasActiveSession }
   */
  async checkAvailability(params = {}) {
    const response = await api.get("/oa/availability", { params });
    return response.data;
  },

  // ============================================
  // Metadata
  // ============================================

  /**
   * Get OA configuration metadata (companies, topics, defaults)
   */
  async getMetadata() {
    const response = await api.get("/oa/metadata");
    return response.data;
  },

  // ============================================
  // Sessions
  // ============================================

  /**
   * Create a new OA session
   * 
   * Possible errors:
   * - 400: Invalid config (duration, question count, etc.)
   * - 409: Active session already exists
   * - 404: No questions found for criteria
   * - 422: Insufficient questions available
   */
  async createSession(config) {
    const response = await api.post("/oa/sessions", config);
    return response.data;
  },

  /**
   * Get user's active session (if any)
   */
  async getActiveSession() {
    const response = await api.get("/oa/sessions/active");
    return response.data;
  },

  /**
   * Get session details
   */
  async getSession(sessionId) {
    const response = await api.get(`/oa/sessions/${sessionId}`);
    return response.data;
  },

  /**
   * Get question details for OA
   */
  async getQuestion(sessionId, questionId) {
    const response = await api.get(
      `/oa/sessions/${sessionId}/questions/${questionId}`
    );
    return response.data;
  },

  /**
   * Submit entire OA session
   */
  async submitSession(sessionId) {
    const response = await api.post(`/oa/sessions/${sessionId}/submit`);
    return response.data;
  },

  /**
   * Terminate session early
   */
  async terminateSession(sessionId, reason = "user_terminated") {
    const response = await api.post(`/oa/sessions/${sessionId}/terminate`, {
      reason,
    });
    return response.data;
  },

  /**
   * Sync timer with server
   */
  async syncTimer(sessionId) {
    const response = await api.get(`/oa/sessions/${sessionId}/sync`);
    return response.data;
  },

  /**
   * Get session history
   */
  async getSessionHistory(page = 1, limit = 10, status) {
    const params = { page, limit };
    if (status) params.status = status;
    const response = await api.get("/oa/sessions", { params });
    return response.data;
  },

  /**
   * Start a quick fight OA
   */
  async quickFight() {
    const response = await api.post("/oa/quick-fight");
    return response.data;
  },

  // ============================================
  // Answers
  // ============================================

  /**
   * Autosave answer
   */
  async saveAnswer(sessionId, questionId, { code, language, timeSpent }) {
    const response = await api.put(
      `/oa/sessions/${sessionId}/answers/${questionId}`,
      { code, language, timeSpent }
    );
    return response.data;
  },

  /**
   * Get saved answer
   */
  async getAnswer(sessionId, questionId) {
    const response = await api.get(
      `/oa/sessions/${sessionId}/answers/${questionId}`
    );
    return response.data;
  },

  /**
   * Run code (practice run against visible test cases)
   */
  async runCode(sessionId, questionId, { code, language }) {
    const response = await api.post(
      `/oa/sessions/${sessionId}/answers/${questionId}/run`,
      { code, language }
    );
    return response.data;
  },

  /**
   * Submit answer for evaluation
   */
  async submitAnswer(sessionId, questionId, { code, language }) {
    const response = await api.post(
      `/oa/sessions/${sessionId}/answers/${questionId}/submit`,
      { code, language }
    );
    return response.data;
  },

  // ============================================
  // Violations
  // ============================================

  /**
   * Record a proctoring violation
   */
  async recordViolation(sessionId, type, metadata = {}) {
    const response = await api.post(
      `/oa/sessions/${sessionId}/violations`,
      { type, metadata }
    );
    return response.data;
  },

  /**
   * Get violations for a session
   */
  async getViolations(sessionId) {
    const response = await api.get(
      `/oa/sessions/${sessionId}/violations`
    );
    return response.data;
  },

  // ============================================
  // Reports
  // ============================================

  /**
   * Get OA report
   */
  async getReport(sessionId) {
    const response = await api.get(`/oa/sessions/${sessionId}/report`);
    return response.data;
  },

  /**
   * Get detailed answers for report
   */
  async getReportAnswers(sessionId) {
    const response = await api.get(
      `/oa/sessions/${sessionId}/report/answers`
    );
    return response.data;
  },

  /**
   * Get user's overall OA stats
   */
  async getUserStats() {
    const response = await api.get("/oa/stats");
    return response.data;
  },
};

export default oaService;
