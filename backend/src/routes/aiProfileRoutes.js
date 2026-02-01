import express from "express";
import { protect } from "../middleware/auth/authMiddleware.js";
import {
  getUserAIProfile,
  updateUserAIProfile,
} from "../utils/userStatsAggregator.js";
import Question from "../models/question/Question.js";

const router = express.Router();

router.get("/:id/ai-profile", protect, async (req, res) => {
  try {
    const userId = req.params.id;

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

router.post("/:id/ai-profile/refresh", protect, async (req, res) => {
  try {
    const userId = req.params.id;

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

    const aiContext = {
      title: question.title,
      description: question.description,
      difficulty: question.difficulty,
      constraints: question.constraints,
      tags: question.tags || [],
      topic:
        question.topic ||
        (question.tags?.length > 0 ? question.tags[0] : "General"),
      expectedApproach: question.expectedApproach || null,
      commonMistakes: question.commonMistakes || [],
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
