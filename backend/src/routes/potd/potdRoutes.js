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

/**
 * POTD Routes for Users
 * Base path: /api/potd
 */

// ==========================================
// PUBLIC ROUTES (optionally authenticated)
// ==========================================

// Get today's Problem of the Day
// Optional auth to include user's solve status
router.get("/today", optionalAuth, getTodaysPOTD);

// Get POTD history (past problems)
router.get("/history", optionalAuth, getPOTDHistory);

// Get streak leaderboard
router.get("/leaderboard", getStreakLeaderboard);

// ==========================================
// PROTECTED ROUTES (require authentication)
// ==========================================

// Get user's current streak information
router.get("/streak", protect, getUserStreak);

// Get user's POTD calendar (solved/missed days)
router.get("/calendar", protect, getUserPOTDCalendar);

// Record an attempt on today's POTD
router.post("/attempt", protect, recordPOTDAttempt);

// Mark POTD as solved (called after successful submission)
router.post("/solve", protect, solvePOTD);

export default router;
