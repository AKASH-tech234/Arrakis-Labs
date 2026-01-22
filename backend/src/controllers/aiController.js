import Question from "../models/Question.js";
import Submission from "../models/Submission.js";
import {
  getAIFeedback,
  buildUserHistorySummary,
  checkAIServiceHealth,
} from "../services/aiService.js";

// ═══════════════════════════════════════════════════════════════════════════════
// STRUCTURED LOGGING HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const LOG_PREFIX = {
  INFO: "\x1b[36m[AI-CTRL]\x1b[0m", // Cyan
  SUCCESS: "\x1b[32m[AI-CTRL]\x1b[0m", // Green
  WARN: "\x1b[33m[AI-CTRL]\x1b[0m", // Yellow
  ERROR: "\x1b[31m[AI-CTRL]\x1b[0m", // Red
  DEBUG: "\x1b[35m[AI-CTRL]\x1b[0m", // Magenta
};

const log = {
  info: (msg, data = {}) => {
    console.log(
      `${LOG_PREFIX.INFO} ${msg}`,
      Object.keys(data).length ? JSON.stringify(data, null, 2) : "",
    );
  },
  success: (msg, data = {}) => {
    console.log(
      `${LOG_PREFIX.SUCCESS} ✓ ${msg}`,
      Object.keys(data).length ? JSON.stringify(data, null, 2) : "",
    );
  },
  warn: (msg, data = {}) => {
    console.warn(
      `${LOG_PREFIX.WARN} ⚠ ${msg}`,
      Object.keys(data).length ? JSON.stringify(data, null, 2) : "",
    );
  },
  error: (msg, data = {}) => {
    console.error(
      `${LOG_PREFIX.ERROR} ✗ ${msg}`,
      Object.keys(data).length ? JSON.stringify(data, null, 2) : "",
    );
  },
  debug: (msg, data = {}) => {
    if (process.env.DEBUG_AI === "true") {
      console.log(
        `${LOG_PREFIX.DEBUG} ${msg}`,
        Object.keys(data).length ? JSON.stringify(data, null, 2) : "",
      );
    }
  },
  request: (method, endpoint, userId, extra = {}) => {
    console.log(
      `${LOG_PREFIX.INFO} ─────────────────────────────────────────────`,
    );
    console.log(`${LOG_PREFIX.INFO} ${method} ${endpoint}`);
    console.log(`${LOG_PREFIX.INFO} User: ${userId}`);
    Object.entries(extra).forEach(([k, v]) => {
      console.log(`${LOG_PREFIX.INFO} ${k}: ${v}`);
    });
    console.log(
      `${LOG_PREFIX.INFO} ─────────────────────────────────────────────`,
    );
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK ENDPOINT
// GET /api/ai/health
// ═══════════════════════════════════════════════════════════════════════════════
export const getAIHealth = async (req, res) => {
  try {
    log.info("Health check requested");
    const aiHealthy = await checkAIServiceHealth();

    res.json({
      success: true,
      backend: "ok",
      aiService: aiHealthy ? "ok" : "unavailable",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error("Health check failed", { error: error.message });
    res.status(500).json({
      success: false,
      backend: "ok",
      aiService: "error",
      error: error.message,
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// UNIFIED AI FEEDBACK ENDPOINT
// POST /api/ai/feedback
//
// CRITICAL: This endpoint is called for ALL submissions (accepted, failed, TLE)
// Progressive hints are returned based on verdict type
// ═══════════════════════════════════════════════════════════════════════════════
export const requestAIFeedback = async (req, res) => {
  const startTime = Date.now();

  try {
    const userId = req.user?._id;
    if (!userId) {
      log.warn("Unauthenticated request rejected");
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { questionId, code, language, verdict, errorType } = req.body;

    log.request("POST", "/api/ai/feedback", userId, {
      questionId,
      language,
      verdict,
      codeLength: code?.length || 0,
    });

    // Validate required fields
    if (!questionId || !code || !language || !verdict) {
      log.warn("Missing required fields", {
        questionId: !!questionId,
        code: !!code,
        language: !!language,
        verdict: !!verdict,
      });
      return res.status(400).json({
        success: false,
        message: "questionId, code, language, and verdict are required",
      });
    }

    log.info(`Processing ${verdict.toUpperCase()} submission`, {
      userId: userId.toString(),
      questionId,
    });

    // Get question details for context
    log.debug("Fetching question details", { questionId });
    const question = await Question.findById(questionId).lean();
    if (!question) {
      log.warn("Question not found", { questionId });
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }
    log.debug("Question found", {
      title: question.title,
      difficulty: question.difficulty,
    });

    // Get user's recent submission history for context
    log.debug("Fetching user submission history");
    const recentSubmissions = await Submission.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .select("status questionId")
      .lean();

    const userHistorySummary = buildUserHistorySummary(recentSubmissions);
    log.debug("User history summary built", {
      submissionCount: recentSubmissions.length,
    });

    // Get problem category from question tags
    const problemCategory =
      question.tags?.length > 0
        ? question.tags.join(", ")
        : question.difficulty || "General";

    // Call AI service
    log.info("Calling AI Service...", { problemCategory, verdict });
    const aiStartTime = Date.now();

    const aiFeedback = await getAIFeedback({
      userId: userId.toString(),
      problemId: questionId.toString(),
      problemCategory,
      constraints: question.constraints || "No specific constraints",
      code,
      language,
      verdict,
      userHistorySummary,
    });

    const aiDuration = Date.now() - aiStartTime;

    if (!aiFeedback) {
      log.error("AI Service returned null", { aiDuration });
      return res.status(503).json({
        success: false,
        message: "AI feedback service is temporarily unavailable",
      });
    }

    log.success(`AI feedback received in ${aiDuration}ms`, {
      hintCount: aiFeedback.hints?.length || 0,
      hasExplanation: !!aiFeedback.explanation,
      hasPattern: !!aiFeedback.detected_pattern,
      feedbackType: aiFeedback.feedback_type,
    });

    const totalDuration = Date.now() - startTime;
    log.success(`Request completed in ${totalDuration}ms`);

    // Return the structured DTO from AI service
    res.status(200).json({
      success: true,
      data: {
        hints: aiFeedback.hints || [],
        explanation: aiFeedback.explanation,
        detectedPattern: aiFeedback.detected_pattern,
        feedbackType: aiFeedback.feedback_type,
        verdict: aiFeedback.verdict,
        submissionId: aiFeedback.submission_id,
        improvementHint:
          aiFeedback.improvement_hint || aiFeedback.hints?.[1]?.content,
        optimizationTips: aiFeedback.optimization_tips,
        complexityAnalysis: aiFeedback.complexity_analysis,
        edgeCases: aiFeedback.edge_cases,
      },
      meta: {
        aiDurationMs: aiDuration,
        totalDurationMs: totalDuration,
      },
    });
  } catch (error) {
    log.error("Request failed", {
      error: error.message,
      stack: error.stack?.split("\n")[1],
    });
    res.status(500).json({
      success: false,
      message: "Failed to generate AI feedback",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get AI learning summary for accepted submission
 * POST /api/ai/summary
 *
 * Called automatically when submission is accepted
 */
export const getAILearningSummary = async (req, res) => {
  const startTime = Date.now();

  try {
    const userId = req.user?._id;
    if (!userId) {
      log.warn("Unauthenticated summary request rejected");
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { questionId, code, language } = req.body;

    log.request("POST", "/api/ai/summary", userId, { questionId, language });

    if (!questionId || !code || !language) {
      log.warn("Missing required fields for summary");
      return res.status(400).json({
        success: false,
        message: "questionId, code, and language are required",
      });
    }

    log.info("Processing learning summary request");

    // Get question details
    const question = await Question.findById(questionId).lean();
    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    // Get user's submission history
    const recentSubmissions = await Submission.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .select("status questionId")
      .lean();

    const userHistorySummary = buildUserHistorySummary(recentSubmissions);

    const problemCategory =
      question.tags?.length > 0
        ? question.tags.join(", ")
        : question.difficulty || "General";

    // Call AI service with "Accepted" verdict for summary
    const aiFeedback = await getAIFeedback({
      userId: userId.toString(),
      problemId: questionId.toString(),
      problemCategory,
      constraints: question.constraints || "No specific constraints",
      code,
      language,
      verdict: "accepted",
      userHistorySummary,
    });

    if (!aiFeedback) {
      log.error("AI Service returned null for summary");
      return res.status(503).json({
        success: false,
        message: "AI service is temporarily unavailable",
      });
    }

    const totalDuration = Date.now() - startTime;
    log.success(`Learning summary generated in ${totalDuration}ms`);

    // Return learning and report data for accepted submissions
    res.status(200).json({
      success: true,
      data: {
        hints: aiFeedback.hints || [],
        explanation: aiFeedback.explanation,
        detectedPattern: aiFeedback.detected_pattern,
        feedbackType: aiFeedback.feedback_type,
        learningRecommendation: aiFeedback.learning_recommendation,
        weeklyReport: aiFeedback.weekly_report,
        difficultyAdjustment: aiFeedback.difficulty_adjustment,
        optimizationTips: aiFeedback.optimization_tips,
      },
      meta: {
        totalDurationMs: totalDuration,
      },
    });
  } catch (error) {
    log.error("Summary request failed", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to generate AI summary",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
