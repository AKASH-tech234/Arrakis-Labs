import express from "express";
import rateLimit from "express-rate-limit";
import { protect } from "../middleware/auth/authMiddleware.js";
import {
  getOAMetadata,
  seedCompanyPatterns,
  createSession,
  getActiveSession,
  getSession,
  getQuestion,
  submitSession,
  terminateSession,
  syncTimer,
  getSessionHistory,
  quickFight,
  checkAvailability,
  saveAnswer,
  runCode,
  submitAnswer,
  getAnswer,
  recordViolation,
  getViolations,
  getReport,
  getReportAnswers,
  getUserStats,
} from "../controllers/oa/index.js";

const router = express.Router();

// OA-specific rate limiter for code execution
const oaCodeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  skip: () => process.env.NODE_ENV !== "production",
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  message: {
    success: false,
    error: "Too many code execution requests. Please slow down.",
  },
});

// ============================================
// Metadata Routes
// ============================================

// GET /api/oa/metadata - Get OA configuration metadata
router.get("/metadata", protect, getOAMetadata);

// POST /api/oa/admin/seed-companies - Seed company patterns (admin)
router.post("/admin/seed-companies", protect, seedCompanyPatterns);

// ============================================
// Pre-flight & Availability Routes
// ============================================

// GET /api/oa/availability - Check question availability before starting
router.get("/availability", protect, checkAvailability);

// ============================================
// Session Routes
// ============================================

// POST /api/oa/sessions - Create new OA session
router.post("/sessions", protect, createSession);

// GET /api/oa/sessions/active - Get user's active session
router.get("/sessions/active", protect, getActiveSession);

// GET /api/oa/sessions - Get session history
router.get("/sessions", protect, getSessionHistory);

// POST /api/oa/quick-fight - Start quick fight OA
router.post("/quick-fight", protect, quickFight);

// GET /api/oa/sessions/:sessionId - Get session details
router.get("/sessions/:sessionId", protect, getSession);

// GET /api/oa/sessions/:sessionId/questions/:questionId - Get question details
router.get("/sessions/:sessionId/questions/:questionId", protect, getQuestion);

// POST /api/oa/sessions/:sessionId/submit - Submit entire OA
router.post("/sessions/:sessionId/submit", protect, submitSession);

// POST /api/oa/sessions/:sessionId/terminate - Terminate session
router.post("/sessions/:sessionId/terminate", protect, terminateSession);

// GET /api/oa/sessions/:sessionId/sync - Sync timer
router.get("/sessions/:sessionId/sync", protect, syncTimer);

// ============================================
// Answer Routes
// ============================================

// PUT /api/oa/sessions/:sessionId/answers/:questionId - Autosave answer
router.put("/sessions/:sessionId/answers/:questionId", protect, saveAnswer);

// GET /api/oa/sessions/:sessionId/answers/:questionId - Get saved answer
router.get("/sessions/:sessionId/answers/:questionId", protect, getAnswer);

// POST /api/oa/sessions/:sessionId/answers/:questionId/run - Run code (practice)
router.post("/sessions/:sessionId/answers/:questionId/run", protect, oaCodeLimiter, runCode);

// POST /api/oa/sessions/:sessionId/answers/:questionId/submit - Submit answer
router.post(
  "/sessions/:sessionId/answers/:questionId/submit",
  protect,
  oaCodeLimiter,
  submitAnswer
);

// ============================================
// Violation Routes
// ============================================

// POST /api/oa/sessions/:sessionId/violations - Record violation
router.post("/sessions/:sessionId/violations", protect, recordViolation);

// GET /api/oa/sessions/:sessionId/violations - Get violations
router.get("/sessions/:sessionId/violations", protect, getViolations);

// ============================================
// Report Routes
// ============================================

// GET /api/oa/sessions/:sessionId/report - Get OA report
router.get("/sessions/:sessionId/report", protect, getReport);

// GET /api/oa/sessions/:sessionId/report/answers - Get detailed answers
router.get("/sessions/:sessionId/report/answers", protect, getReportAnswers);

// GET /api/oa/stats - Get user's overall OA stats
router.get("/stats", protect, getUserStats);

export default router;
