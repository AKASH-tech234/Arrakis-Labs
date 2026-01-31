import { OASession, OAAnswer } from "../../models/oa/index.js";
import { evaluationEngine } from "../../services/oa/index.js";

/**
 * Autosave answer (debounced from frontend)
 * PUT /api/oa/sessions/:sessionId/answers/:questionId
 */
export const saveAnswer = async (req, res) => {
  try {
    const { sessionId, questionId } = req.params;
    const { code, language, timeSpent } = req.body;
    const userId = req.user._id;

    // Verify session is active
    const session = await OASession.findOne({
      _id: sessionId,
      userId,
      status: "live",
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Session not found or not active",
      });
    }

    // Verify question belongs to session
    const sessionQuestion = session.questions.find(
      (q) => q.refId.toString() === questionId
    );

    if (!sessionQuestion) {
      return res.status(404).json({
        success: false,
        error: "Question not found in this session",
      });
    }

    // Update or create answer
    const now = new Date();
    const answer = await OAAnswer.findOneAndUpdate(
      { sessionId, refId: questionId },
      {
        $set: {
          "answer.code": code,
          "answer.language": language || "python",
          serverUpdatedAt: now,
        },
        $inc: { timeSpentSeconds: Math.max(0, timeSpent || 0) },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    res.json({
      success: true,
      data: {
        refId: questionId,
        savedAt: now,
        timeSpent: answer.timeSpentSeconds,
      },
    });
  } catch (error) {
    console.error("Error saving answer:", error);
    res.status(500).json({
      success: false,
      error: "Failed to save answer",
      message: error.message,
    });
  }
};

/**
 * Run code (practice run without submitting)
 * POST /api/oa/sessions/:sessionId/answers/:questionId/run
 */
export const runCode = async (req, res) => {
  try {
    const { sessionId, questionId } = req.params;
    const { code, language, customInput } = req.body;
    const userId = req.user._id;

    // Verify session is active
    const session = await OASession.findOne({
      _id: sessionId,
      userId,
      status: "live",
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Session not found or not active",
      });
    }

    // Verify question belongs to session
    const sessionQuestion = session.questions.find(
      (q) => q.refId.toString() === questionId
    );

    if (!sessionQuestion) {
      return res.status(404).json({
        success: false,
        error: "Question not found in this session",
      });
    }

    // Autosave before running
    await OAAnswer.findOneAndUpdate(
      { sessionId, refId: questionId },
      {
        $set: {
          "answer.code": code,
          "answer.language": language || "python",
          serverUpdatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    // Run against visible test cases
    const results = await evaluationEngine.runCode(questionId, code, language);

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Error running code:", error);
    res.status(500).json({
      success: false,
      error: "Failed to run code",
      message: error.message,
    });
  }
};

/**
 * Submit answer for evaluation
 * POST /api/oa/sessions/:sessionId/answers/:questionId/submit
 */
export const submitAnswer = async (req, res) => {
  try {
    const { sessionId, questionId } = req.params;
    const { code, language } = req.body;
    const userId = req.user._id;

    // Verify session is active
    const session = await OASession.findOne({
      _id: sessionId,
      userId,
      status: "live",
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Session not found or not active",
      });
    }

    // Verify question belongs to session
    const sessionQuestion = session.questions.find(
      (q) => q.refId.toString() === questionId
    );

    if (!sessionQuestion) {
      return res.status(404).json({
        success: false,
        error: "Question not found in this session",
      });
    }

    // Autosave before submission
    await OAAnswer.findOneAndUpdate(
      { sessionId, refId: questionId },
      {
        $set: {
          "answer.code": code,
          "answer.language": language || "python",
          serverUpdatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    // Evaluate against all test cases (including hidden)
    const result = await evaluationEngine.evaluateCodingSubmission(
      sessionId,
      questionId,
      code,
      language,
      userId
    );

    // Get updated answer for points
    const answer = await OAAnswer.findOne({ sessionId, refId: questionId });

    res.json({
      success: true,
      data: {
        verdict: result.verdict,
        passed: result.passed,
        total: result.total,
        results: result.results,
        executionTime: result.executionTime,
        pointsEarned: answer?.pointsEarned || 0,
        maxPoints: sessionQuestion.points,
      },
    });
  } catch (error) {
    console.error("Error submitting answer:", error);
    res.status(500).json({
      success: false,
      error: "Failed to submit answer",
      message: error.message,
    });
  }
};

/**
 * Get answer for a question
 * GET /api/oa/sessions/:sessionId/answers/:questionId
 */
export const getAnswer = async (req, res) => {
  try {
    const { sessionId, questionId } = req.params;
    const userId = req.user._id;

    // Verify session ownership
    const session = await OASession.findOne({
      _id: sessionId,
      userId,
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Session not found",
      });
    }

    const answer = await OAAnswer.findOne({
      sessionId,
      refId: questionId,
    });

    if (!answer) {
      return res.json({
        success: true,
        data: null,
      });
    }

    res.json({
      success: true,
      data: {
        refId: answer.refId,
        code: answer.answer?.code || "",
        language: answer.answer?.language || "python",
        isSubmitted: answer.submission?.isSubmitted || false,
        verdict: answer.submission?.verdict || null,
        passedCount: answer.submission?.passedCount || 0,
        totalCount: answer.submission?.totalCount || 0,
        pointsEarned: answer.pointsEarned || 0,
        maxPoints: answer.maxPoints,
        timeSpent: answer.timeSpentSeconds || 0,
      },
    });
  } catch (error) {
    console.error("Error getting answer:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get answer",
      message: error.message,
    });
  }
};
