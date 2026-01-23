import express from "express";
import { verifyAdmin, requireSuperAdmin, auditLog } from "../middleware/adminMiddleware.js";
import {
  schedulePOTD,
  getScheduledPOTDs,
  deleteScheduledPOTD,
  getAvailableProblems,
  forcePublishPOTD,
  getPOTDAnalytics,
  getSchedulerStatus,
} from "../controllers/adminPOTDController.js";

const router = express.Router();

/**
 * Admin POTD Routes
 * Base path: /api/admin/potd
 * All routes require admin authentication
 */

// Apply admin authentication to all routes
router.use(verifyAdmin);

// ==========================================
// POTD SCHEDULING
// ==========================================

// Get scheduled POTDs (calendar view)
router.get("/schedule", getScheduledPOTDs);

// Schedule a problem as POTD
router.post(
  "/schedule",
  auditLog("SCHEDULE_POTD"),
  schedulePOTD
);

// Delete a scheduled POTD (only if not locked)
router.delete(
  "/schedule/:id",
  auditLog("DELETE_POTD_SCHEDULE"),
  deleteScheduledPOTD
);

// ==========================================
// PROBLEM SELECTION
// ==========================================

// Get available problems for POTD selection
router.get("/available-problems", getAvailableProblems);

// ==========================================
// ANALYTICS & MONITORING
// ==========================================

// Get POTD analytics
router.get("/analytics", getPOTDAnalytics);

// Get scheduler status
router.get("/scheduler-status", getSchedulerStatus);

// ==========================================
// EMERGENCY OPERATIONS (Super Admin)
// ==========================================

// Force publish today's POTD
router.post(
  "/force-publish",
  requireSuperAdmin,
  auditLog("FORCE_PUBLISH_POTD"),
  forcePublishPOTD
);

export default router;
