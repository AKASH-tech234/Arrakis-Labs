import express from "express";
import { protect } from "../middleware/auth/authMiddleware.js";
import {
  getUserAIProfile,
  updateUserAIProfile,
} from "../utils/userStatsAggregator.js";
import Question from "../models/question/Question.js";

const router = express.Router();

/**
 * @route   GET /api/users/:id/ai-profile
 * @desc    Get user's AI-computed cognitive profile
 * @access  Private
 */
router.get("/:id/ai-profile", protect, async (req, res) => {
  try {
    const userId = req.params.id;

    // Only allow users to access their own profile (or admin)
    if (req.user._id.toString() !== userId && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this profile",
      });
    }

    const aiProfile = await getUserAIProfile(userId);

    res.json({
      success: true,
      data: aiProfile,
    });
  } catch (error) {
    console.error("[AI Profile] Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to get AI profile",
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/users/:id/ai-profile/refresh
 * @desc    Force refresh user's AI profile
 * @access  Private
 */
router.post("/:id/ai-profile/refresh", protect, async (req, res) => {
  try {
    const userId = req.params.id;

    // Only allow users to refresh their own profile (or admin)
    if (req.user._id.toString() !== userId && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to refresh this profile",
      });
    }

    const aiProfile = await updateUserAIProfile(userId, true);

    res.json({
      success: true,
      message: "AI profile refreshed",
      data: aiProfile,
    });
  } catch (error) {
    console.error("[AI Profile] Refresh error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to refresh AI profile",
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/questions/:id/ai-context
 * @desc    Get problem's AI context for feedback generation
 * @access  Private
 */
router.get("/questions/:id/ai-context", protect, async (req, res) => {
  try {
    const questionId = req.params.id;

    const question = await Question.findById(questionId)
      .select(
        "title description difficulty constraints tags topic expectedApproach commonMistakes timeComplexityHint spaceComplexityHint",
      )
      .lean();

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    // Build AI context (infer if fields not set)
    const aiContext = {
      title: question.title,
      description: question.description,
      difficulty: question.difficulty,
      constraints: question.constraints,
      tags: question.tags || [],
      topic:
        question.topic ||
        (question.tags?.length > 0 ? question.tags[0] : "General"),
      expectedApproach: question.expectedApproach || null, // Let AI infer if not set
      commonMistakes: question.commonMistakes || [], // Let AI infer if empty
      timeComplexityHint: question.timeComplexityHint || null,
      spaceComplexityHint: question.spaceComplexityHint || null,
    };

    res.json({
      success: true,
      data: aiContext,
    });
  } catch (error) {
    console.error("[AI Context] Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to get AI context",
      error: error.message,
    });
  }
});

export default router;
