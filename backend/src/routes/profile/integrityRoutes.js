/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * USER PLAGIARISM ROUTES
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Routes for users to view their own plagiarism/integrity status.
 * Users can see flagged submissions and submit appeals.
 */

import express from "express";
import { protect } from "../../middleware/auth/authMiddleware.js";
import {
  getMyIntegrityStatus,
  getContestIntegrityDetails,
  submitAppeal,
  getAppealStatus,
} from "../../controllers/profile/integrityController.js";

const router = express.Router();

// Get user's overall integrity status
router.get("/status", protect, getMyIntegrityStatus);

// Get details for a specific contest
router.get("/contests/:contestId", protect, getContestIntegrityDetails);

// Submit an appeal for a flagged result
router.post("/appeals", protect, submitAppeal);

// Get status of an appeal
router.get("/appeals/:appealId", protect, getAppealStatus);

export default router;
