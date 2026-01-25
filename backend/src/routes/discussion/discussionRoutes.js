import express from "express";
import rateLimit from "express-rate-limit";
import { protect, optionalAuth } from "../../middleware/auth/authMiddleware.js";
import {
  listProblemDiscussions,
  createSolutionPost,
  listThreadMessages,
  postComment,
  voteSolution,
} from "../../controllers/discussion/discussionController.js";

const router = express.Router();

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  skip: () => process.env.NODE_ENV === "test",
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
});

// LeetCode-like: problem-scoped discussions (solutions list)
router.get("/problems/:id/discussions", optionalAuth, listProblemDiscussions);
router.get("/problems/:id/solutions", optionalAuth, listProblemDiscussions);

// Create solution post (accepted-only enforced on backend)
router.post("/problems/:id/solutions", protect, writeLimiter, createSolutionPost);

// Thread messages
router.get("/threads/:threadId/messages", optionalAuth, listThreadMessages);

// Comments
router.post("/discussions/comment", protect, writeLimiter, postComment);

// Voting
router.post("/solutions/:solutionPostId/vote", protect, writeLimiter, voteSolution);

export default router;
