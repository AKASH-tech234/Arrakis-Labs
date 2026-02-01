/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PLAGIARISM ADMIN ROUTES
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Admin routes for plagiarism detection management
 */

import express from "express";
import {
  runPlagiarismCheck,
  getPlagiarismStatus,
  getPlagiarismResults,
  getComparisonDetails,
  updateResultStatus,
  getCheatingGroups,
  getGroupDetails,
  overrideMemberPenalty,
  getUserPlagiarismHistory,
  getDashboardStats,
  exportPlagiarismReport,
} from "../../controllers/admin/plagiarismAdminController.js";
import { verifyAdmin } from "../../middleware/admin/adminMiddleware.js";

const router = express.Router();

// All routes require admin authentication
router.use(verifyAdmin);

// Dashboard
router.get("/dashboard", getDashboardStats);

// Contest-level operations
router.post("/contests/:contestId/run", runPlagiarismCheck);
router.get("/contests/:contestId/status", getPlagiarismStatus);
router.get("/contests/:contestId/results", getPlagiarismResults);
router.get("/contests/:contestId/groups", getCheatingGroups);
router.get("/contests/:contestId/export", exportPlagiarismReport);

// Comparison details and review
router.get("/compare/:resultId", getComparisonDetails);
router.patch("/results/:resultId", updateResultStatus);

// Cheating group management
router.get("/groups/:groupId", getGroupDetails);
router.patch("/groups/:groupId/members/:userId", overrideMemberPenalty);

// User history
router.get("/users/:userId/history", getUserPlagiarismHistory);

export default router;
