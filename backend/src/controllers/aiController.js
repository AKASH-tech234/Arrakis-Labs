import Question from "../models/Question.js";
import Submission from "../models/Submission.js";
import {
  getAIFeedback,
  buildUserHistorySummary,
} from "../services/aiService.js";

/**
 * Request AI feedback on-demand
 * POST /api/ai/feedback
 *
 * This endpoint is called when user explicitly clicks "Get AI Feedback" button
 */
export const requestAIFeedback = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { questionId, code, language, verdict, errorType } = req.body;

    // Validate required fields
    if (!questionId || !code || !language || !verdict) {
      return res.status(400).json({
        success: false,
        message: "questionId, code, language, and verdict are required",
      });
    }

    // Don't allow AI feedback for accepted submissions (they should use summary endpoint)
    if (verdict === "accepted") {
      return res.status(400).json({
        success: false,
        message: "AI feedback is only available for failed submissions",
      });
    }

    console.log(
      `[AI Feedback] User ${userId} requesting feedback for problem ${questionId}`,
    );

    // Get question details for context
    const question = await Question.findById(questionId).lean();
    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    // Get user's recent submission history for context
    const recentSubmissions = await Submission.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .select("status questionId")
      .lean();

    const userHistorySummary = buildUserHistorySummary(recentSubmissions);

    // Get problem category from question tags
    const problemCategory =
      question.tags?.length > 0
        ? question.tags.join(", ")
        : question.difficulty || "General";

    // Call AI service
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

    if (!aiFeedback) {
      return res.status(503).json({
        success: false,
        message: "AI feedback service is temporarily unavailable",
      });
    }

    console.log(
      `[AI Feedback] Successfully generated feedback for user ${userId}`,
    );

    res.status(200).json({
      success: true,
      data: {
        explanation: aiFeedback.explanation,
        improvementHint: aiFeedback.improvement_hint,
        detectedPattern: aiFeedback.detected_pattern,
        learningRecommendation: aiFeedback.learning_recommendation,
        difficultyAdjustment: aiFeedback.difficulty_adjustment,
        weeklyReport: aiFeedback.weekly_report,
      },
    });
  } catch (error) {
    console.error("[AI Feedback] Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to generate AI feedback",
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
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { questionId, code, language } = req.body;

    if (!questionId || !code || !language) {
      return res.status(400).json({
        success: false,
        message: "questionId, code, and language are required",
      });
    }

    console.log(
      `[AI Summary] User ${userId} requesting summary for problem ${questionId}`,
    );

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
      return res.status(503).json({
        success: false,
        message: "AI service is temporarily unavailable",
      });
    }

    console.log(
      `[AI Summary] Successfully generated summary for user ${userId}`,
    );

    // Return only learning and report data for accepted submissions
    res.status(200).json({
      success: true,
      data: {
        learningRecommendation: aiFeedback.learning_recommendation,
        weeklyReport: aiFeedback.weekly_report,
        difficultyAdjustment: aiFeedback.difficulty_adjustment,
      },
    });
  } catch (error) {
    console.error("[AI Summary] Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to generate AI summary",
    });
  }
};
