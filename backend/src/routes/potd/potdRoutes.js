import express from "express";
import { protect, optionalAuth } from "../../middleware/auth/authMiddleware.js";
import {
  getTodaysPOTD,
  getUserStreak,
  getUserPOTDCalendar,
  recordPOTDAttempt,
  solvePOTD,
  getPOTDHistory,
  getStreakLeaderboard,
} from "../../controllers/potd/potdController.js";

const router = express.Router();

router.get("/today", optionalAuth, getTodaysPOTD);

router.get("/history", optionalAuth, getPOTDHistory);

router.get("/leaderboard", getStreakLeaderboard);

router.get("/streak", protect, getUserStreak);

router.get("/calendar", protect, getUserPOTDCalendar);

router.post("/attempt", protect, recordPOTDAttempt);

router.post("/solve", protect, solvePOTD);

export default router;
