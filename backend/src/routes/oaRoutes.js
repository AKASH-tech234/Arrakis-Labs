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

router.get("/metadata", protect, getOAMetadata);

router.post("/admin/seed-companies", protect, seedCompanyPatterns);

router.get("/availability", protect, checkAvailability);

router.post("/sessions", protect, createSession);

router.get("/sessions/active", protect, getActiveSession);

router.get("/sessions", protect, getSessionHistory);

router.post("/quick-fight", protect, quickFight);

router.get("/sessions/:sessionId", protect, getSession);

router.get("/sessions/:sessionId/questions/:questionId", protect, getQuestion);

router.post("/sessions/:sessionId/submit", protect, submitSession);

router.post("/sessions/:sessionId/terminate", protect, terminateSession);

router.get("/sessions/:sessionId/sync", protect, syncTimer);

router.put("/sessions/:sessionId/answers/:questionId", protect, saveAnswer);

router.get("/sessions/:sessionId/answers/:questionId", protect, getAnswer);

router.post("/sessions/:sessionId/answers/:questionId/run", protect, oaCodeLimiter, runCode);

router.post(
  "/sessions/:sessionId/answers/:questionId/submit",
  protect,
  oaCodeLimiter,
  submitAnswer
);

router.post("/sessions/:sessionId/violations", protect, recordViolation);

router.get("/sessions/:sessionId/violations", protect, getViolations);

router.get("/sessions/:sessionId/report", protect, getReport);

router.get("/sessions/:sessionId/report/answers", protect, getReportAnswers);

router.get("/stats", protect, getUserStats);

export default router;
