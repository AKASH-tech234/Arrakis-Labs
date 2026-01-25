import axios from "axios";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const AI_TIMEOUT_MS = 90000; 

const LOG_PREFIX = {
  INFO: "\x1b[36m[AI-SVC]\x1b[0m", 
  SUCCESS: "\x1b[32m[AI-SVC]\x1b[0m", 
  WARN: "\x1b[33m[AI-SVC]\x1b[0m", 
  ERROR: "\x1b[31m[AI-SVC]\x1b[0m", 
  HTTP: "\x1b[35m[AI-SVC]\x1b[0m", 
};

const log = {
  info: (msg, data) => {
    console.log(`${LOG_PREFIX.INFO} ${msg}`, data ? JSON.stringify(data) : "");
  },
  success: (msg, data) => {
    console.log(
      `${LOG_PREFIX.SUCCESS} ✓ ${msg}`,
      data ? JSON.stringify(data) : "",
    );
  },
  warn: (msg, data) => {
    console.warn(
      `${LOG_PREFIX.WARN} ⚠ ${msg}`,
      data ? JSON.stringify(data) : "",
    );
  },
  error: (msg, data) => {
    console.error(
      `${LOG_PREFIX.ERROR} ✗ ${msg}`,
      data ? JSON.stringify(data) : "",
    );
  },
  http: (method, url, status, duration) => {
    const statusColor = status >= 400 ? "\x1b[31m" : "\x1b[32m";
    console.log(
      `${LOG_PREFIX.HTTP} ${method} ${url} ${statusColor}${status}\x1b[0m ${duration}ms`,
    );
  },
};

const VERDICT_MAP = {
  accepted: "Accepted",
  wrong_answer: "Wrong Answer",
  time_limit_exceeded: "Time Limit Exceeded",
  memory_limit_exceeded: "Memory Limit Exceeded",
  runtime_error: "Runtime Error",
  compile_error: "Compile Error",
  internal_error: "Internal Error",
  pending: "Pending",
  running: "Running",
};

const ERROR_TYPE_MAP = {
  wrong_answer: "Wrong Answer",
  time_limit_exceeded: "TLE",
  memory_limit_exceeded: "MLE",
  runtime_error: "Runtime Error",
  compile_error: "Compile Error",
};

export function buildUserHistorySummary(submissions) {
  if (!submissions || submissions.length === 0) {
    return null;
  }

  const total = submissions.length;
  const accepted = submissions.filter((s) => s.status === "accepted").length;
  const wrongAnswer = submissions.filter(
    (s) => s.status === "wrong_answer",
  ).length;
  const tle = submissions.filter(
    (s) => s.status === "time_limit_exceeded",
  ).length;
  const runtimeError = submissions.filter(
    (s) => s.status === "runtime_error",
  ).length;
  const compileError = submissions.filter(
    (s) => s.status === "compile_error",
  ).length;

  const failedSubmissions = submissions.filter((s) => s.status !== "accepted");

  let summary = `Recent ${total} submissions: ${accepted} accepted, ${total - accepted} failed.`;

  if (wrongAnswer > 0) summary += ` Wrong answers: ${wrongAnswer}.`;
  if (tle > 0) summary += ` TLE: ${tle}.`;
  if (runtimeError > 0) summary += ` Runtime errors: ${runtimeError}.`;
  if (compileError > 0) summary += ` Compile errors: ${compileError}.`;

  return summary;
}

<<<<<<< HEAD:backend/src/services/ai/aiService.js
=======
/**
 * Request AI feedback for a submission
 * @param {Object} params - Submission context
 * @param {string} params.userId - User ID
 * @param {string} params.problemId - Question/Problem ID
 * @param {string} params.problemCategory - Category/tags of the problem
 * @param {string} params.constraints - Problem constraints
 * @param {string} params.code - Submitted code
 * @param {string} params.language - Programming language
 * @param {string} params.verdict - Submission verdict (backend format)
 * @param {string|null} params.userHistorySummary - User's submission history summary
 * @param {Object|null} params.problem - Full problem object for AI context
 * @param {Object|null} params.userProfile - User's AI profile for personalization
 * @returns {Promise<Object|null>} - AI feedback response or null on failure
 */
>>>>>>> model:backend/src/services/aiService.js
export async function getAIFeedback({
  userId,
  problemId,
  problemCategory,
  constraints,
  code,
  language,
  verdict,
  userHistorySummary,
  problem = null,
  userProfile = null,
}) {
  const startTime = Date.now();
  const url = `${AI_SERVICE_URL}/ai/feedback`;

  try {
    log.info("Preparing AI request", {
      userId,
      problemId,
      verdict,
      language,
      codeLength: code?.length,
      hasProblemContext: !!problem,
      hasUserProfile: !!userProfile,
    });

    const payload = {
      user_id: userId,
      problem_id: problemId,
      problem_category: problemCategory || "General",
      constraints: constraints || "No specific constraints",
      code: code,
      language: language,
      verdict: VERDICT_MAP[verdict] || verdict,
      error_type: ERROR_TYPE_MAP[verdict] || null,
      user_history_summary: userHistorySummary,
      // Enhanced context for AI personalization
      problem: problem
        ? {
            title: problem.title,
            difficulty: problem.difficulty,
            tags: problem.tags || [],
            topic: problem.topic || problemCategory,
            expected_approach: problem.expectedApproach || null,
            common_mistakes: problem.commonMistakes || [],
            time_complexity_hint: problem.timeComplexityHint || null,
            space_complexity_hint: problem.spaceComplexityHint || null,
          }
        : null,
      user_profile: userProfile
        ? {
            common_mistakes: userProfile.commonMistakes || [],
            weak_topics: userProfile.weakTopics || [],
            strong_topics: userProfile.strongTopics || [],
            recurring_patterns: userProfile.recurringPatterns || [],
            success_rate: userProfile.successRate || 0,
            total_submissions: userProfile.totalSubmissions || 0,
            recent_categories: userProfile.recentCategories || [],
            skill_levels: userProfile.skillLevels || {},
            difficulty_readiness: userProfile.difficultyReadiness || {
              easy: 1.0,
              medium: 0.5,
              hard: 0.2,
            },
          }
        : null,
    };

    log.info(`→ POST ${url}`, {
      verdict: payload.verdict,
      error_type: payload.error_type,
      hasProblem: !!payload.problem,
      hasUserProfile: !!payload.user_profile,
    });

    const response = await axios.post(url, payload, {
      timeout: AI_TIMEOUT_MS,
      headers: {
        "Content-Type": "application/json",
      },
    });

    const duration = Date.now() - startTime;
    log.http("POST", "/ai/feedback", response.status, duration);

    log.success("AI feedback received", {
      hintCount: response.data?.hints?.length || 0,
      feedbackType: response.data?.feedback_type,
      hasExplanation: !!response.data?.explanation,
    });

    return response.data;
  } catch (error) {
    const duration = Date.now() - startTime;

    if (error.response) {
      log.http("POST", "/ai/feedback", error.response.status, duration);
      log.error("AI Service error response", {
        status: error.response.status,
        data: error.response.data,
      });
    } else if (error.code === "ECONNREFUSED") {
      log.error("AI Service connection refused", {
        url: AI_SERVICE_URL,
        message: "Is the AI service running?",
      });
    } else if (error.code === "ETIMEDOUT" || error.code === "ECONNABORTED") {
      log.error("AI Service timeout", {
        timeout: AI_TIMEOUT_MS,
        duration,
      });
    } else {
      log.error("AI Service request failed", {
        code: error.code,
        message: error.message,
      });
    }

    return null;
  }
}

export async function checkAIServiceHealth() {
  const startTime = Date.now();
  const url = `${AI_SERVICE_URL}/health`;

  try {
    log.info(`Health check → ${url}`);
    const response = await axios.get(url, { timeout: 5000 });
    const duration = Date.now() - startTime;

    log.http("GET", "/health", response.status, duration);

    if (response.data?.status === "ok") {
      log.success("AI Service is healthy", {
        version: response.data.version,
        timestamp: response.data.timestamp,
      });
      return true;
    }

    log.warn("AI Service returned unexpected status", response.data);
    return false;
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error("Health check failed", {
      duration,
      error: error.message,
      code: error.code,
    });
    return false;
  }
}

export default {
  getAIFeedback,
  buildUserHistorySummary,
  checkAIServiceHealth,
};

// ═══════════════════════════════════════════════════════════════════════════════
// MIM (Misconception Identification Model) API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get MIM model status
 * @returns {Promise<Object|null>}
 */
export async function getMIMStatus() {
  const startTime = Date.now();
  const url = `${AI_SERVICE_URL}/ai/mim/status`;

  try {
    log.info(`MIM Status → ${url}`);
    const response = await axios.get(url, { timeout: 10000 });
    const duration = Date.now() - startTime;

    log.http("GET", "/ai/mim/status", response.status, duration);
    log.success("MIM status retrieved", response.data);
    return response.data;
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error("MIM status check failed", {
      duration,
      error: error.message,
    });
    return null;
  }
}

/**
 * Get user's cognitive profile from MIM
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>}
 */
export async function getMIMProfile(userId) {
  const startTime = Date.now();
  const url = `${AI_SERVICE_URL}/ai/mim/profile/${encodeURIComponent(userId)}`;

  try {
    log.info(`MIM Profile → ${url}`, { userId });
    const response = await axios.get(url, { timeout: 15000 });
    const duration = Date.now() - startTime;

    log.http("GET", `/ai/mim/profile/${userId}`, response.status, duration);
    log.success("MIM profile retrieved", {
      userId,
      hasStrengths: !!response.data?.strengths,
      hasWeaknesses: !!response.data?.weaknesses,
    });
    return response.data;
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error("MIM profile fetch failed", {
      userId,
      duration,
      error: error.message,
    });
    return null;
  }
}

/**
 * Get personalized problem recommendations from MIM
 * @param {string} userId - User ID
 * @param {number} [limit=5] - Number of recommendations
 * @returns {Promise<Object|null>}
 */
export async function getMIMRecommendations(userId, limit = 5) {
  const startTime = Date.now();
  const url = `${AI_SERVICE_URL}/ai/mim/recommend/${encodeURIComponent(userId)}?limit=${limit}`;

  try {
    log.info(`MIM Recommendations → ${url}`, { userId, limit });
    const response = await axios.get(url, { timeout: 20000 });
    const duration = Date.now() - startTime;

    log.http("GET", `/ai/mim/recommend/${userId}`, response.status, duration);
    log.success("MIM recommendations retrieved", {
      userId,
      count: response.data?.recommendations?.length || 0,
    });
    return response.data;
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error("MIM recommendations fetch failed", {
      userId,
      duration,
      error: error.message,
    });
    return null;
  }
}

/**
 * Get pre-submission prediction from MIM
 * @param {string} userId - User ID
 * @param {string} problemId - Problem ID
 * @returns {Promise<Object|null>}
 */
export async function getMIMPrediction(userId, problemId) {
  const startTime = Date.now();
  const url = `${AI_SERVICE_URL}/ai/mim/predict/${encodeURIComponent(userId)}/${encodeURIComponent(problemId)}`;

  try {
    log.info(`MIM Prediction → ${url}`, { userId, problemId });
    const response = await axios.get(url, { timeout: 10000 });
    const duration = Date.now() - startTime;

    log.http(
      "GET",
      `/ai/mim/predict/${userId}/${problemId}`,
      response.status,
      duration,
    );
    log.success("MIM prediction retrieved", {
      userId,
      problemId,
      successProbability: response.data?.success_probability,
    });
    return response.data;
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error("MIM prediction fetch failed", {
      userId,
      problemId,
      duration,
      error: error.message,
    });
    return null;
  }
}

/**
 * Trigger MIM model training (admin only)
 * @returns {Promise<Object|null>}
 */
export async function triggerMIMTraining() {
  const startTime = Date.now();
  const url = `${AI_SERVICE_URL}/ai/mim/train`;

  try {
    log.info(`MIM Training Trigger → ${url}`);
    const response = await axios.post(url, {}, { timeout: 5000 });
    const duration = Date.now() - startTime;

    log.http("POST", "/ai/mim/train", response.status, duration);
    log.success("MIM training triggered", response.data);
    return response.data;
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error("MIM training trigger failed", {
      duration,
      error: error.message,
    });
    return null;
  }
}
