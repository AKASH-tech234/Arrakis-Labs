import express from "express";
import { optionalAuth } from "../../middleware/auth/authMiddleware.js";
import {
  getContestHistory,
  getContestStats,
  getContestRating,
} from "../../controllers/contest/contestProfileController.js";

const router = express.Router();

router.get("/history", optionalAuth, getContestHistory);
router.get("/stats", optionalAuth, getContestStats);
router.get("/rating", optionalAuth, getContestRating);

export default router;
