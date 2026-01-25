import express from "express";
import { protect, optionalAuth } from "../../middleware/auth/authMiddleware.js";
import {
  getContests,
  getContest,
  registerForContest,
  joinContest,
  getContestProblem,
  getLeaderboard,
  getUserStanding,
  getContestAnalytics,
} from "../../controllers/contest/contestController.js";
import {
  contestRun,
  contestSubmit,
  getContestSubmissions,
  getSubmissionDetails,
} from "../../controllers/contest/contestJudgeController.js";
import rateLimit from "express-rate-limit";

const router = express.Router();

// ==========================================
// RATE LIMITERS
// ==========================================

// Rate limit for contest code execution
const contestCodeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Max 10 submissions per minute during contest
  message: {
    success: false,
    message: "Too many submissions. Please wait before trying again.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.user?._id || req.ip}_${req.params.contestId}`,
});

// Rate limit for run (test) - more lenient
const contestRunLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30, // More runs allowed
  message: {
    success: false,
    message: "Too many test runs. Please wait before trying again.",
  },
  keyGenerator: (req) => `${req.user?._id || req.ip}_run_${req.params.contestId}`,
});

// ==========================================
// PUBLIC ROUTES (no auth required)
// ==========================================

// Get all contests (with optional auth for user-specific data)
router.get("/", optionalAuth, getContests);

// Get single contest details
router.get("/:contestId", optionalAuth, getContest);

// Get leaderboard (public during contest if allowed)
router.get("/:contestId/leaderboard", optionalAuth, getLeaderboard);

// ==========================================
// PROTECTED ROUTES (auth required)
// ==========================================

// Register for contest
router.post("/:contestId/register", protect, registerForContest);

// Join contest (start participating)
router.post("/:contestId/join", protect, joinContest);

// Get contest problem details
router.get("/:contestId/problems/:problemId", protect, getContestProblem);

// Run code (visible test cases only)
router.post("/:contestId/run", protect, contestRunLimiter, contestRun);

// Submit code (all test cases)
router.post("/:contestId/submit", protect, contestCodeLimiter, contestSubmit);

// Get user's submissions for this contest
router.get("/:contestId/submissions", protect, getContestSubmissions);

// Get specific submission details
router.get("/:contestId/submissions/:submissionId", protect, getSubmissionDetails);

// Get user's standing/rank
router.get("/:contestId/standing", protect, getUserStanding);

// Get user's analytics (post-contest)
router.get("/:contestId/analytics", protect, getContestAnalytics);

export default router;
