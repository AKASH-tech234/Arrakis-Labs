import crypto from "crypto";
import Question from "../../models/question/Question.js";
import Submission from "../../models/profile/Submission.js";
import {
  getAIFeedback,
  buildUserHistorySummary,
  checkAIServiceHealth,
  transformMIMInsights,
} from "../../services/ai/aiService.js";

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION GATES - Prevent unnecessary AI workflow execution
// ═══════════════════════════════════════════════════════════════════════════════

// Verdicts that should trigger AI feedback
const AI_ELIGIBLE_VERDICTS = [
  "accepted",
  "wrong_answer",
  "time_limit_exceeded",
  "runtime_error",
];

// Verdicts that should NOT trigger AI (show raw error instead)
const SKIP_AI_VERDICTS = [
  "compile_error",
  "internal_error",
  "pending",
  "running",
];

// Cache for duplicate submission detection (in-memory, short-lived)
const recentSubmissionCache = new Map();
const CACHE_TTL_MS = 30000; // 30 seconds
const MAX_CACHE_SIZE = 1000;

/**
 * Generate a unique hash for a submission to detect duplicates
 */
function generateSubmissionHash(userId, questionId, code, verdict) {
  const codeHash = crypto
    .createHash("md5")
    .update(code || "")
    .digest("hex");
  return `${userId}:${questionId}:${codeHash}:${verdict}`;
}

/**
 * Check if this is a duplicate submission within the cache window
 */
function isDuplicateSubmission(hash) {
  const cached = recentSubmissionCache.get(hash);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.response;
  }
  return null;
}

/**
 * Cache a successful AI response for duplicate detection
 */
function cacheSubmissionResponse(hash, response) {
  // Prune old entries if cache is full
  if (recentSubmissionCache.size >= MAX_CACHE_SIZE) {
    const now = Date.now();
    for (const [key, value] of recentSubmissionCache.entries()) {
      if (now - value.timestamp > CACHE_TTL_MS) {
        recentSubmissionCache.delete(key);
      }
    }
  }
  recentSubmissionCache.set(hash, {
    response,
    timestamp: Date.now(),
  });
}

/**
 * Validate required metadata for AI feedback
 * Returns { valid: boolean, error?: string }
 */
function validateMetadata({ questionId, code, language, verdict, userId }) {
  const errors = [];

  if (!userId) errors.push("user_id");
  if (!questionId) errors.push("problem_id");
  if (!language) errors.push("language");
  if (!verdict) errors.push("verdict");

  if (errors.length > 0) {
    return {
      valid: false,
      error: `Missing required fields: ${errors.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Validate code is not empty or whitespace-only
 * Returns { valid: boolean, error?: string }
 */
function validateCode(code) {
  if (!code) {
    return {
      valid: false,
      error:
        "No code provided. Please submit your code before requesting AI feedback.",
    };
  }

  const trimmedCode = code.trim();
  if (trimmedCode.length === 0) {
    return {
      valid: false,
      error:
        "Code is empty or contains only whitespace. Please write your solution first.",
    };
  }

  // Minimum meaningful code check
  if (trimmedCode.length < 10) {
    return {
      valid: false,
      error: "Code is too short. Please write a meaningful solution.",
    };
  }

  return { valid: true };
}

/**
 * Check if verdict is eligible for AI feedback
 * Returns { eligible: boolean, reason?: string }
 */
function checkVerdictEligibility(verdict) {
  const normalizedVerdict = String(verdict).toLowerCase().replace(/ /g, "_");

  if (SKIP_AI_VERDICTS.includes(normalizedVerdict)) {
    return {
      eligible: false,
      reason: `AI feedback is not available for '${verdict}' submissions. Please check the error output.`,
    };
  }

  if (!AI_ELIGIBLE_VERDICTS.includes(normalizedVerdict)) {
    return {
      eligible: false,
      reason: `Unknown verdict '${verdict}'. AI feedback requires a valid submission result.`,
    };
  }

  return { eligible: true };
}

const LOG_PREFIX = {
  INFO: "\x1b[36m[AI-CTRL]\x1b[0m",
  SUCCESS: "\x1b[32m[AI-CTRL]\x1b[0m",
  WARN: "\x1b[33m[AI-CTRL]\x1b[0m",
  ERROR: "\x1b[31m[AI-CTRL]\x1b[0m",
  DEBUG: "\x1b[35m[AI-CTRL]\x1b[0m",
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

export const requestAIFeedback = async (req, res) => {
  const startTime = Date.now();

  try {
    const userId = req.user?._id;

    // ═══════════════════════════════════════════════════════════════════════
    // GATE 1: Authentication Check
    // ═══════════════════════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════════════════════
    // GATE 2: Required Metadata Validation
    // ═══════════════════════════════════════════════════════════════════════
    const metadataValidation = validateMetadata({
      questionId,
      code,
      language,
      verdict,
      userId: userId.toString(),
    });

    if (!metadataValidation.valid) {
      log.warn("Invalid metadata", { error: metadataValidation.error });
      return res.status(400).json({
        success: false,
        message: metadataValidation.error,
        gate: "metadata_validation",
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GATE 3: Empty Code Validation
    // ═══════════════════════════════════════════════════════════════════════
    const codeValidation = validateCode(code);
    if (!codeValidation.valid) {
      log.warn("Empty code rejected", { error: codeValidation.error });
      return res.status(400).json({
        success: false,
        message: codeValidation.error,
        gate: "empty_code",
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GATE 4: Verdict Eligibility Check (Skip AI for compile_error)
    // ═══════════════════════════════════════════════════════════════════════
    const verdictCheck = checkVerdictEligibility(verdict);
    if (!verdictCheck.eligible) {
      log.info("Verdict not eligible for AI feedback", {
        verdict,
        reason: verdictCheck.reason,
      });
      return res.status(200).json({
        success: true,
        data: null,
        message: verdictCheck.reason,
        gate: "verdict_ineligible",
        skipped: true,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GATE 5: Duplicate Submission Check (Return cached response)
    // ═══════════════════════════════════════════════════════════════════════
    const submissionHash = generateSubmissionHash(
      userId.toString(),
      questionId,
      code,
      verdict,
    );

    const cachedResponse = isDuplicateSubmission(submissionHash);
    if (cachedResponse) {
      log.info("Returning cached response for duplicate submission", {
        hash: submissionHash.slice(0, 20),
      });
      return res.status(200).json({
        ...cachedResponse,
        meta: {
          ...cachedResponse.meta,
          cached: true,
          gate: "duplicate_submission",
        },
      });
    }

    log.info(`Processing ${verdict.toUpperCase()} submission`, {
      userId: userId.toString(),
      questionId,
    });

    log.debug("Fetching question details", { questionId });
    console.log("📖 Fetching question from MongoDB:", questionId);

    const question = await Question.findById(questionId).lean();

    if (!question) {
      console.log("❌ Question not found in MongoDB:", questionId);
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

    const problemCategory =
      question.tags?.length > 0
        ? question.tags.join(", ")
        : question.difficulty || "General";

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
      // Pass full problem context for better AI responses
      problem: {
        title: question.title,
        difficulty: question.difficulty,
        tags: question.tags || [],
        topic: question.topic || problemCategory,
        description: question.description,
        expectedApproach: question.expectedApproach || null,
        commonMistakes: question.commonMistakes || [],
        timeComplexityHint: question.timeComplexityHint || null,
        spaceComplexityHint: question.spaceComplexityHint || null,
        // v3.2: Add canonical algorithms for feedback grounding
        canonicalAlgorithms: question.canonicalAlgorithms || [],
      },
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

    // Transform MIM V3.0 insights for frontend
    const transformedMIMInsights = transformMIMInsights(
      aiFeedback.mim_insights,
    );

    const responseBody = {
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
        // MIM V3.0 insights (transformed for frontend)
        mimInsights: transformedMIMInsights,
        // v3.3: New fields for enhanced feedback
        rootCause: aiFeedback.root_cause || null,
        rootCauseSubtype: aiFeedback.root_cause_subtype || null,
        failureMechanism: aiFeedback.failure_mechanism || null,
        correctCode: aiFeedback.correct_code || null,
        correctCodeExplanation: aiFeedback.correct_code_explanation || null,
        conceptReinforcement: aiFeedback.concept_reinforcement || null,
      },
      meta: {
        aiDurationMs: aiDuration,
        totalDurationMs: totalDuration,
      },
    };

    // Cache successful response for duplicate detection
    cacheSubmissionResponse(submissionHash, responseBody);

    res.status(200).json(responseBody);
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

    const question = await Question.findById(questionId).lean();
    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

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

    const aiFeedback = await getAIFeedback({
      userId: userId.toString(),
      problemId: questionId.toString(),
      problemCategory,
      constraints: question.constraints || "No specific constraints",
      code,
      language,
      verdict: "accepted",
      userHistorySummary,
      // v3.2: Pass full problem context
      problem: {
        title: question.title,
        difficulty: question.difficulty,
        tags: question.tags || [],
        topic: question.topic || problemCategory,
        description: question.description,
        expectedApproach: question.expectedApproach || null,
        commonMistakes: question.commonMistakes || [],
        timeComplexityHint: question.timeComplexityHint || null,
        spaceComplexityHint: question.spaceComplexityHint || null,
        canonicalAlgorithms: question.canonicalAlgorithms || [],
      },
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
