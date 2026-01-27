// ═══════════════════════════════════════════════════════════════════════════════
// MIM (Misconception Identification Model) Routes
// Proxy routes for MIM AI service endpoints
// ═══════════════════════════════════════════════════════════════════════════════

import express from "express";
import { protect } from "../middleware/auth/authMiddleware.js";
import { verifyAdmin } from "../middleware/admin/adminMiddleware.js";
import {
  getMIMStatus,
  getMIMProfile,
  getMIMRecommendations,
  getMIMPrediction,
  triggerMIMTraining,
} from "../services/ai/aiService.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// STRUCTURED LOGGING
// ─────────────────────────────────────────────────────────────────────────────
const LOG_PREFIX = {
  INFO: "\x1b[36m[MIM-ROUTE]\x1b[0m",
  SUCCESS: "\x1b[32m[MIM-ROUTE]\x1b[0m",
  ERROR: "\x1b[31m[MIM-ROUTE]\x1b[0m",
};

const log = {
  info: (msg, data) =>
    console.log(`${LOG_PREFIX.INFO} ${msg}`, data ? JSON.stringify(data) : ""),
  success: (msg, data) =>
    console.log(
      `${LOG_PREFIX.SUCCESS} ✓ ${msg}`,
      data ? JSON.stringify(data) : "",
    ),
  error: (msg, data) =>
    console.error(
      `${LOG_PREFIX.ERROR} ✗ ${msg}`,
      data ? JSON.stringify(data) : "",
    ),
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/mim/status
 * Get MIM model status (public)
 */
router.get("/status", async (req, res) => {
  try {
    log.info("MIM status requested");
    const status = await getMIMStatus();

    if (!status) {
      return res.status(503).json({
        success: false,
        message: "MIM service unavailable",
      });
    }

    log.success("MIM status retrieved");
    res.json({ success: true, data: status });
  } catch (error) {
    log.error("MIM status error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to get MIM status",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PROTECTED ROUTES (require authentication)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/mim/profile/:userId
 * Get user's cognitive profile
 */
router.get("/profile/:userId", protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user?._id?.toString();

    // Users can only access their own profile (unless admin)
    if (userId !== requestingUserId && !req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied: Can only view your own profile",
      });
    }

    log.info("MIM profile requested", { userId });
    const profile = await getMIMProfile(userId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found or MIM service unavailable",
      });
    }

    log.success("MIM profile retrieved", { userId });
    res.json({ success: true, data: profile });
  } catch (error) {
    log.error("MIM profile error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to get MIM profile",
    });
  }
});

/**
 * GET /api/mim/recommend/:userId
 * Get personalized problem recommendations
 */
router.get("/recommend/:userId", protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 5;
    const requestingUserId = req.user?._id?.toString();

    // Users can only get their own recommendations
    if (userId !== requestingUserId && !req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied: Can only view your own recommendations",
      });
    }

    log.info("MIM recommendations requested", { userId, limit });
    const recommendations = await getMIMRecommendations(userId, limit);

    if (!recommendations) {
      return res.status(404).json({
        success: false,
        message: "Recommendations not available or MIM service unavailable",
      });
    }

    log.success("MIM recommendations retrieved", {
      userId,
      count: recommendations?.recommendations?.length || 0,
    });
    res.json({ success: true, data: recommendations });
  } catch (error) {
    log.error("MIM recommendations error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to get MIM recommendations",
    });
  }
});

/**
 * GET /api/mim/predict/:userId/:problemId
 * Get pre-submission prediction
 */
router.get("/predict/:userId/:problemId", protect, async (req, res) => {
  try {
    const { userId, problemId } = req.params;
    const requestingUserId = req.user?._id?.toString();

    // Users can only get their own predictions
    if (userId !== requestingUserId && !req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied: Can only view your own predictions",
      });
    }

    log.info("MIM prediction requested", { userId, problemId });
    const prediction = await getMIMPrediction(userId, problemId);

    if (!prediction) {
      return res.status(404).json({
        success: false,
        message: "Prediction not available or MIM service unavailable",
      });
    }

    log.success("MIM prediction retrieved", { userId, problemId });
    res.json({ success: true, data: prediction });
  } catch (error) {
    log.error("MIM prediction error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to get MIM prediction",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ROUTES (require admin authentication)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/mim/train
 * Trigger MIM model training (admin only)
 */
router.post("/train", verifyAdmin, async (req, res) => {
  try {
    log.info("MIM training triggered by admin", {
      adminId: req.admin?._id?.toString(),
    });

    const result = await triggerMIMTraining();

    if (!result) {
      return res.status(503).json({
        success: false,
        message: "Failed to trigger training or MIM service unavailable",
      });
    }

    log.success("MIM training triggered successfully");
    res.json({
      success: true,
      message: "Training triggered successfully",
      data: result,
    });
  } catch (error) {
    log.error("MIM training trigger error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to trigger MIM training",
    });
  }
});

export default router;
