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

const contestCodeLimiter = rateLimit({
  windowMs: 60 * 1000, 
  max: 10, 
  message: {
    success: false,
    message: "Too many submissions. Please wait before trying again.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.user?._id || req.ip}_${req.params.contestId}`,
});

const contestRunLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30, 
  message: {
    success: false,
    message: "Too many test runs. Please wait before trying again.",
  },
  keyGenerator: (req) => `${req.user?._id || req.ip}_run_${req.params.contestId}`,
});

router.get("/", optionalAuth, getContests);

router.get("/:contestId", optionalAuth, getContest);

router.get("/:contestId/leaderboard", optionalAuth, getLeaderboard);

router.post("/:contestId/register", protect, registerForContest);

router.post("/:contestId/join", protect, joinContest);

router.get("/:contestId/problems/:problemId", protect, getContestProblem);

router.post("/:contestId/run", protect, contestRunLimiter, contestRun);

router.post("/:contestId/submit", protect, contestCodeLimiter, contestSubmit);

router.get("/:contestId/submissions", protect, getContestSubmissions);

router.get("/:contestId/submissions/:submissionId", protect, getSubmissionDetails);

router.get("/:contestId/standing", protect, getUserStanding);

router.get("/:contestId/analytics", protect, getContestAnalytics);

export default router;
