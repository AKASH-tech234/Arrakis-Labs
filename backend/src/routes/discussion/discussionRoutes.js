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

router.get("/problems/:id/discussions", optionalAuth, listProblemDiscussions);
router.get("/problems/:id/solutions", optionalAuth, listProblemDiscussions);

router.post("/problems/:id/solutions", protect, writeLimiter, createSolutionPost);

router.get("/threads/:threadId/messages", optionalAuth, listThreadMessages);

router.post("/discussions/comment", protect, writeLimiter, postComment);

router.post("/solutions/:solutionPostId/vote", protect, writeLimiter, voteSolution);

export default router;
