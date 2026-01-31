import mongoose from "mongoose";
import {
  OAConfig,
  OASession,
  OAAnswer,
  UserOAHistory,
} from "../../models/oa/index.js";
import {
  questionSelectionEngine,
  oaScheduler,
  evaluationEngine,
  reportGenerator,
} from "../../services/oa/index.js";

/**
 * Generate unique request ID for logging
 */
const generateRequestId = () => `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

/**
 * Validate session creation request payload
 * @returns {Object} { valid: boolean, error?: string, field?: string }
 */
const validateSessionPayload = (config) => {
  // Duration validation
  if (!config.durationMinutes || typeof config.durationMinutes !== "number") {
    return { valid: false, error: "Duration is required and must be a number", field: "durationMinutes" };
  }
  if (config.durationMinutes < 15 || config.durationMinutes > 180) {
    return { valid: false, error: "Duration must be between 15 and 180 minutes", field: "durationMinutes" };
  }

  // Question count validation
  const questionCount = config.questionCounts?.coding;
  if (questionCount !== undefined) {
    if (typeof questionCount !== "number" || questionCount < 1 || questionCount > 5) {
      return { valid: false, error: "Question count must be a number between 1 and 5", field: "questionCount" };
    }
  }

  // Difficulty validation
  const validDifficulties = ["Easy", "Medium", "Hard", "mixed", "adaptive"];
  if (config.difficulty && !validDifficulties.includes(config.difficulty)) {
    return { valid: false, error: `Invalid difficulty. Must be one of: ${validDifficulties.join(", ")}`, field: "difficulty" };
  }

  // Company mode validation
  const validCompanyModes = ["all", "selected"];
  if (config.companyMode && !validCompanyModes.includes(config.companyMode)) {
    return { valid: false, error: "Company mode must be 'all' or 'selected'", field: "companyMode" };
  }

  // If company mode is selected, companies array should exist
  if (config.companyMode === "selected" && (!Array.isArray(config.selectedCompanies) || config.selectedCompanies.length === 0)) {
    return { valid: false, error: "Selected companies required when company mode is 'selected'", field: "selectedCompanies" };
  }

  // Topics validation (optional but must be array if provided)
  if (config.selectedTopics && !Array.isArray(config.selectedTopics)) {
    return { valid: false, error: "Selected topics must be an array", field: "selectedTopics" };
  }

  return { valid: true };
};

/**
 * Create a new OA session
 * POST /api/oa/sessions
 * 
 * HTTP Status Codes:
 * - 201: Session created successfully
 * - 400: Invalid request payload (client error)
 * - 409: Active session already exists (conflict)
 * - 404: No questions found matching criteria
 * - 422: Insufficient questions for requested count
 * - 500: Server/database error
 */
export const createSession = async (req, res) => {
  const requestId = generateRequestId();
  const userId = req.user._id;
  const config = req.body;

  console.log(`[OA Session] [${requestId}] Creating session for user: ${userId}`);
  console.log(`[OA Session] [${requestId}] Config:`, JSON.stringify(config, null, 2));

  try {
    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 1: Validate request payload (400 Bad Request for invalid input)
    // ═══════════════════════════════════════════════════════════════════════════
    const validation = validateSessionPayload(config);
    if (!validation.valid) {
      console.log(`[OA Session] [${requestId}] Validation failed: ${validation.error}`);
      return res.status(400).json({
        success: false,
        error: validation.error,
        field: validation.field,
        code: "INVALID_REQUEST",
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 2: Check for existing active session (409 Conflict)
    // ═══════════════════════════════════════════════════════════════════════════
    const existingSession = await OASession.findOne({
      userId,
      status: { $in: ["scheduled", "live", "paused"] },
    });

    if (existingSession) {
      console.log(`[OA Session] [${requestId}] User has active session: ${existingSession.sessionCode}`);
      return res.status(409).json({
        success: false,
        error: "You already have an active OA session",
        code: "ACTIVE_SESSION_EXISTS",
        existingSession: {
          sessionId: existingSession._id,
          sessionCode: existingSession.sessionCode,
          status: existingSession.status,
          startAt: existingSession.startAt,
          endAt: existingSession.endAt,
        },
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 3: Fetch questions strictly from database (404 if none found)
    // ═══════════════════════════════════════════════════════════════════════════
    const requestedCount = config.questionCounts?.coding || 2;
    
    const selectionResult = await questionSelectionEngine.selectQuestionsStrict(
      config,
      userId,
      requestedCount
    );

    console.log(`[OA Session] [${requestId}] Question selection result:`, {
      totalFound: selectionResult.totalAvailable,
      selectedCount: selectionResult.questions.length,
      criteria: selectionResult.criteria,
    });

    // No questions found at all
    if (selectionResult.totalAvailable === 0) {
      console.log(`[OA Session] [${requestId}] No questions found for criteria`);
      return res.status(404).json({
        success: false,
        error: "No questions available for selected criteria",
        code: "NO_QUESTIONS_FOUND",
        criteria: selectionResult.criteria,
        suggestion: "Try broadening your filters (remove topic/company restrictions or change difficulty)",
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 4: Validate question sufficiency (422 Unprocessable Entity)
    // ═══════════════════════════════════════════════════════════════════════════
    if (selectionResult.questions.length < requestedCount) {
      console.log(`[OA Session] [${requestId}] Insufficient questions: ${selectionResult.questions.length}/${requestedCount}`);
      return res.status(422).json({
        success: false,
        error: `Only ${selectionResult.totalAvailable} questions available, but ${requestedCount} requested`,
        code: "INSUFFICIENT_QUESTIONS",
        available: selectionResult.totalAvailable,
        requested: requestedCount,
        criteria: selectionResult.criteria,
        suggestion: "Reduce question count or broaden your filters",
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 5: Create session atomically with transaction
    // ═══════════════════════════════════════════════════════════════════════════
    const mongoSession = await mongoose.startSession();
    
    try {
      let createdSession;
      let createdAnswers;

      await mongoSession.withTransaction(async () => {
        const now = new Date();

        // Save config
        const mappedConfig = {
          userId,
          companyMode: config.companyMode || "all",
          selectedCompanies: Array.isArray(config.selectedCompanies) ? config.selectedCompanies : [],
          selectedTopics: Array.isArray(config.selectedTopics) ? config.selectedTopics : [],
          difficulty: config.difficulty || "mixed",
          questionCounts: config.questionCounts || { coding: requestedCount },
          fixedDurationMinutes: config.durationMinutes,
          startMode: config.scheduledStartAt ? "scheduled" : "now",
          scheduledStartAt: config.scheduledStartAt || null,
          proctoring: {
            enableTabSwitchDetection: config.proctoring?.detectTabSwitch ?? config.proctoring?.enableTabSwitchDetection ?? true,
            warningsAllowed: config.proctoring?.warningsAllowed ?? 3,
            actionOnExceed: config.proctoring?.actionOnExceed || "auto_submit",
            enableFullscreen: config.proctoring?.enableFullscreen ?? false,
          },
        };

        const savedConfig = await OAConfig.findOneAndUpdate(
          { userId },
          { ...mappedConfig, updatedAt: now },
          { upsert: true, new: true, setDefaultsOnInsert: true, session: mongoSession }
        );

        // Build questions array with snapshots
        const sessionQuestions = selectionResult.questions.map((q, idx) => ({
          refId: q._id,
          order: idx,
          titleSnapshot: q.title,
          topicSnapshot: q.topic || q.categoryType,
          difficultySnapshot: q.difficulty,
          companyTagsSnapshot: Array.isArray(q.tags) ? q.tags : [],
          points: calculatePoints(q.difficulty),
        }));

        // Calculate timing
        const startAt = config.scheduledStartAt ? new Date(config.scheduledStartAt) : now;
        const effectiveStartAt = Number.isNaN(startAt.getTime()) ? now : startAt;
        const startImmediately = effectiveStartAt.getTime() <= now.getTime();
        const endAt = new Date(effectiveStartAt.getTime() + config.durationMinutes * 60 * 1000);

        // Generate unique session code
        let sessionCode = OASession.generateSessionCode();
        for (let attempt = 0; attempt < 5; attempt++) {
          const exists = await OASession.exists({ sessionCode });
          if (!exists) break;
          sessionCode = OASession.generateSessionCode();
        }

        // Create session
        const [session] = await OASession.create([{
          sessionCode,
          userId,
          configId: savedConfig._id,
          status: startImmediately ? "live" : "scheduled",
          questions: sessionQuestions,
          startAt: effectiveStartAt,
          endAt,
          durationMinutes: config.durationMinutes,
          totalPoints: sessionQuestions.reduce((sum, q) => sum + q.points, 0),
          companyContext: config.companyMode === "selected" && config.selectedCompanies?.length
            ? config.selectedCompanies.join(",")
            : null,
          difficulty: config.difficulty,
          proctoring: {
            warningsAllowed: config.proctoring?.warningsAllowed ?? 3,
            warningCount: 0,
            actionOnExceed: config.proctoring?.actionOnExceed || "auto_submit",
          },
          actualStartedAt: startImmediately ? now : null,
        }], { session: mongoSession });

        createdSession = session;

        // Pre-create answer documents with all required fields
        const answerDocs = sessionQuestions.map((q, idx) => ({
          sessionId: session._id,
          userId: userId,
          refId: q.refId,
          questionIndex: idx,
          answer: { code: "", language: "python" },
        }));

        createdAnswers = await OAAnswer.create(answerDocs, { session: mongoSession });
      });

      await mongoSession.endSession();

      console.log(`[OA Session] [${requestId}] Created session: ${createdSession.sessionCode}`);
      console.log(`[OA Session] [${requestId}] Selected question IDs: ${selectionResult.questions.map(q => q._id).join(", ")}`);

      return res.status(201).json({
        success: true,
        data: {
          sessionId: createdSession._id,
          sessionCode: createdSession.sessionCode,
          status: createdSession.status,
          startAt: createdSession.startAt,
          endAt: createdSession.endAt,
          durationMinutes: createdSession.durationMinutes,
          questionCount: createdSession.questions.length,
          totalPoints: createdSession.totalPoints,
          proctoring: createdSession.proctoring,
        },
      });

    } catch (txError) {
      await mongoSession.endSession();
      throw txError; // Re-throw to be caught by outer catch
    }

  } catch (error) {
    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 6: Handle server errors (500 Internal Server Error)
    // ═══════════════════════════════════════════════════════════════════════════
    console.error(`[OA Session] [${requestId}] Server error:`, {
      message: error.message,
      stack: error.stack,
      userId: userId.toString(),
    });

    return res.status(500).json({
      success: false,
      error: "Failed to create OA session due to server error",
      code: "SERVER_ERROR",
      requestId, // For support debugging
    });
  }
};

/**
 * Calculate points based on difficulty
 */
function calculatePoints(difficulty) {
  const map = {
    Easy: 100,
    Medium: 200,
    Hard: 300,
  };
  return map[difficulty] || 200;
}
// Attach to exports for internal use
createSession.calculatePoints = calculatePoints;

/**
 * Get active session for user
 * GET /api/oa/sessions/active
 */
export const getActiveSession = async (req, res) => {
  try {
    const userId = req.user._id;

    const session = await OASession.findOne({
      userId,
      status: { $in: ["scheduled", "live", "paused"] },
    });

    if (!session) {
      return res.json({
        success: true,
        data: null,
        message: "No active session",
      });
    }

    // Check and update status
    const updatedSession = await oaScheduler.checkSession(session._id);

    // Calculate server time for timer sync
    const now = new Date();
    const remainingMs = Math.max(0, updatedSession.endAt - now);

    res.json({
      success: true,
      data: {
        sessionId: updatedSession._id,
        sessionCode: updatedSession.sessionCode,
        status: updatedSession.status,
        startAt: updatedSession.startAt,
        endAt: updatedSession.endAt,
        serverTime: now,
        remainingMs,
        durationMinutes: updatedSession.durationMinutes,
        questionCount: updatedSession.questions.length,
        totalPoints: updatedSession.totalPoints,
        proctoring: updatedSession.proctoring,
      },
    });
  } catch (error) {
    console.error("Error getting active session:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get active session",
      message: error.message,
    });
  }
};

/**
 * Get session details (questions, answers, etc.)
 * GET /api/oa/sessions/:sessionId
 */
export const getSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;

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

    // Check and update status
    const updatedSession = await oaScheduler.checkSession(session._id);

    // Only return full details if session is live or completed
    if (
      updatedSession.status === "scheduled" &&
      new Date() < updatedSession.startAt
    ) {
      return res.json({
        success: true,
        data: {
          sessionId: updatedSession._id,
          sessionCode: updatedSession.sessionCode,
          status: updatedSession.status,
          startAt: updatedSession.startAt,
          message: "Session not started yet",
        },
      });
    }

    // Get answers
    const answers = await OAAnswer.find({ sessionId }).lean();
    const answersMap = {};
    answers.forEach((a) => {
      answersMap[a.refId.toString()] = {
        code: a.answer?.code || "",
        language: a.answer?.language || "python",
        isSubmitted: a.submission?.isSubmitted || false,
        verdict: a.submission?.verdict || null,
        passedCount: a.submission?.passedCount || 0,
        totalCount: a.submission?.totalCount || 0,
        timeSpent: a.timeSpentSeconds || 0,
      };
    });

    // Calculate server time for timer sync
    const now = new Date();
    const remainingMs = Math.max(0, updatedSession.endAt - now);

    // Build questions list (don't expose full question content here)
    const questions = updatedSession.questions.map((q) => ({
      refId: q.refId,
      order: q.order,
      title: q.titleSnapshot,
      topic: q.topicSnapshot,
      difficulty: q.difficultySnapshot,
      points: q.points,
      type: q.type,
      answer: answersMap[q.refId.toString()] || null,
    }));

    res.json({
      success: true,
      data: {
        sessionId: updatedSession._id,
        sessionCode: updatedSession.sessionCode,
        status: updatedSession.status,
        startAt: updatedSession.startAt,
        endAt: updatedSession.endAt,
        serverTime: now,
        remainingMs,
        durationMinutes: updatedSession.durationMinutes,
        questions,
        totalPoints: updatedSession.totalPoints,
        proctoring: updatedSession.proctoring,
        currentQuestionIndex: updatedSession.currentQuestionIndex || 0,
      },
    });
  } catch (error) {
    console.error("Error getting session:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get session",
      message: error.message,
    });
  }
};

/**
 * Get question details for OA
 * GET /api/oa/sessions/:sessionId/questions/:questionId
 */
export const getQuestion = async (req, res) => {
  try {
    const { sessionId, questionId } = req.params;
    const userId = req.user._id;

    // Verify session ownership and status
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

    // Check if question belongs to session
    const sessionQuestion = session.questions.find(
      (q) => q.refId.toString() === questionId
    );

    if (!sessionQuestion) {
      return res.status(404).json({
        success: false,
        error: "Question not found in this session",
      });
    }

    // Get full question details
    const Question = (await import("../../models/question/Question.js")).default;
    const question = await Question.findById(questionId).lean();

    if (!question) {
      return res.status(404).json({
        success: false,
        error: "Question not found",
      });
    }

    // Get visible test cases
    const TestCase = (await import("../../models/question/TestCase.js")).default;
    const testCases = await TestCase.find({
      questionId,
      isActive: true,
      isHidden: false,
    })
      .sort({ order: 1 })
      .lean();

    // Infer input/output format from all active test cases (including hidden)
    const allTestCasesForFormat = await TestCase.find({
      questionId,
      isActive: true,
    })
      .sort({ order: 1 })
      .select("stdin expectedStdout")
      .lean();

    const { inferIOFormatsFromTestCases } = await import(
      "../../utils/ioFormatInference.js"
    );
    const { inputFormat, outputFormat } = inferIOFormatsFromTestCases(
      allTestCasesForFormat,
    );

    // Get user's saved answer
    const answer = await OAAnswer.findOne({ sessionId, refId: questionId });

    // Update current question index
    await OASession.findByIdAndUpdate(sessionId, {
      currentQuestionIndex: sessionQuestion.order,
    });

    res.json({
      success: true,
      data: {
        refId: question._id,
        title: question.title,
        description: question.description,
        difficulty: question.difficulty,
        topic: question.topic || question.categoryType,
        constraints: question.constraints,
        inputFormat,
        outputFormat,
        points: sessionQuestion.points,
        testCases: testCases.map((tc) => ({
          id: tc._id,
          label: tc.label,
          stdin: tc.stdin,
          expectedOutput: tc.expectedStdout,
        })),
        languages: question.supportedLanguages || [
          "python",
          "javascript",
          "java",
          "cpp",
        ],
        starterCode: question.starterCode,
        savedAnswer: answer
          ? {
              code: answer.answer?.code || "",
              language: answer.answer?.language || "python",
              isSubmitted: answer.submission?.isSubmitted || false,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Error getting question:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get question",
      message: error.message,
    });
  }
};

/**
 * Submit entire OA session
 * POST /api/oa/sessions/:sessionId/submit
 */
export const submitSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;

    const session = await OASession.findOne({
      _id: sessionId,
      userId,
      status: { $in: ["live", "paused"] },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Session not found or already submitted",
      });
    }

    // Evaluate any pending submissions
    const answers = await OAAnswer.find({
      sessionId,
      "submission.isSubmitted": false,
      "answer.code": { $exists: true, $ne: "" },
    });

    for (const answer of answers) {
      if (answer.answer?.code?.trim()) {
        try {
          await evaluationEngine.evaluateCodingSubmission(
            sessionId,
            answer.refId,
            answer.answer.code,
            answer.answer.language,
            userId
          );
        } catch (err) {
          console.error(`[Submit] Error evaluating ${answer.refId}:`, err.message);
        }
      }
    }

    // Update session status
    session.status = "submitted";
    session.submittedAt = new Date();
    await session.save();

    // Generate report
    let report = null;
    try {
      report = await reportGenerator.generateReport(session._id);
    } catch (err) {
      console.error("[Submit] Report generation failed:", err.message);
    }

    res.json({
      success: true,
      data: {
        sessionId: session._id,
        sessionCode: session.sessionCode,
        status: session.status,
        submittedAt: session.submittedAt,
        reportId: report?._id,
      },
    });
  } catch (error) {
    console.error("Error submitting session:", error);
    res.status(500).json({
      success: false,
      error: "Failed to submit session",
      message: error.message,
    });
  }
};

/**
 * Terminate session (forced end)
 * POST /api/oa/sessions/:sessionId/terminate
 */
export const terminateSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;

    const session = await OASession.findOne({
      _id: sessionId,
      userId,
      status: { $in: ["scheduled", "live", "paused"] },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Session not found or already ended",
      });
    }

    session.status = "terminated";
    session.terminatedReason = reason || "user_terminated";
    session.submittedAt = new Date();
    await session.save();

    // Generate report for terminated session
    try {
      await reportGenerator.generateReport(session._id);
    } catch (err) {
      console.error("[Terminate] Report generation failed:", err.message);
    }

    res.json({
      success: true,
      data: {
        sessionId: session._id,
        status: session.status,
        terminatedReason: session.terminatedReason,
      },
    });
  } catch (error) {
    console.error("Error terminating session:", error);
    res.status(500).json({
      success: false,
      error: "Failed to terminate session",
      message: error.message,
    });
  }
};

/**
 * Sync timer with server
 * GET /api/oa/sessions/:sessionId/sync
 */
export const syncTimer = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;

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

    const now = new Date();
    const remainingMs = Math.max(0, session.endAt - now);

    res.json({
      success: true,
      data: {
        serverTime: now,
        endAt: session.endAt,
        remainingMs,
        status: session.status,
      },
    });
  } catch (error) {
    console.error("Error syncing timer:", error);
    res.status(500).json({
      success: false,
      error: "Failed to sync timer",
      message: error.message,
    });
  }
};

/**
 * Get user's session history
 * GET /api/oa/sessions
 */
export const getSessionHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10, status } = req.query;

    const query = { userId };
    if (status) {
      query.status = status;
    }

    const sessions = await OASession.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await OASession.countDocuments(query);

    res.json({
      success: true,
      data: {
        sessions: sessions.map((s) => ({
          sessionId: s._id,
          sessionCode: s.sessionCode,
          status: s.status,
          startAt: s.startAt,
          endAt: s.endAt,
          submittedAt: s.submittedAt,
          questionCount: s.questions.length,
          totalPoints: s.totalPoints,
          configSnapshot: s.configSnapshot,
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Error getting session history:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get session history",
      message: error.message,
    });
  }
};

/**
 * Quick fight - start OA with random defaults
 * POST /api/oa/quick-fight
 */
export const quickFight = async (req, res) => {
  // Set default config for quick fight
  req.body = {
    companyMode: "all",
    selectedCompanies: [],
    selectedTopics: [],
    difficulty: "mixed",
    durationMinutes: 45,
    questionCounts: { coding: 2 },
    proctoring: {
      detectTabSwitch: true,
      warningsAllowed: 3,
    },
    startImmediately: true,
  };

  // Delegate to createSession - all error handling is done there
  return createSession(req, res);
};

/**
 * Pre-flight availability check
 * GET /api/oa/availability
 * 
 * Returns available question count before session creation
 * Prevents user frustration by checking availability first
 */
export const checkAvailability = async (req, res) => {
  const requestId = `avail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const userId = req.user._id;
    const { difficulty, topics, companies, companyMode } = req.query;

    console.log(`[OA Availability] [${requestId}] Checking for user: ${userId}`);

    // Build config from query params
    const config = {
      difficulty: difficulty || "mixed",
      selectedTopics: topics ? topics.split(",").filter(Boolean) : [],
      companyMode: companyMode || "all",
      selectedCompanies: companies ? companies.split(",").filter(Boolean) : [],
    };

    // Get availability from question selection engine
    const availability = await questionSelectionEngine.checkAvailability(config, userId);

    console.log(`[OA Availability] [${requestId}] Result:`, availability);

    // Check if user has active session
    const activeSession = await OASession.findOne({
      userId,
      status: { $in: ["scheduled", "live", "paused"] },
    });

    return res.status(200).json({
      success: true,
      data: {
        available: availability.total,
        byDifficulty: availability.byDifficulty,
        canStartSession: availability.total > 0 && !activeSession,
        hasActiveSession: !!activeSession,
        activeSessionCode: activeSession?.sessionCode || null,
        maxQuestions: Math.min(availability.total, 5),
        criteria: availability.criteria,
      },
    });

  } catch (error) {
    console.error(`[OA Availability] [${requestId}] Error:`, error);
    return res.status(500).json({
      success: false,
      error: "Failed to check availability",
      code: "SERVER_ERROR",
    });
  }
};
