import express from "express";
import { protect, optionalAuth } from "../middleware/authMiddleware.js";
import { getProfileAnalytics } from "../controllers/profileAnalyticsController.js";
import {
  listPlatformProfiles,
  addPlatformProfile,
  updatePlatformProfile,
  getPublicSettings,
  upsertPublicSettings,
} from "../controllers/platformProfilesController.js";
import {
  deletePlatformProfile,
  syncPlatformProfileHandler,
  getCodingProfileSummary,
} from "../controllers/codingProfileController.js";

const router = express.Router();

// Analytics (supports both my profile and public username lookups)
router.get("/analytics", optionalAuth, getProfileAnalytics);

// Platform aggregation settings
router.get("/platforms", protect, listPlatformProfiles);
router.post("/platform", protect, addPlatformProfile);
router.put("/platform/:id", protect, updatePlatformProfile);
router.delete("/platform/:id", protect, deletePlatformProfile);
router.post("/platform/:id/sync", protect, syncPlatformProfileHandler);

// Coding Profile summary (DB-only)
router.get("/coding-summary", protect, getCodingProfileSummary);

// Public profile settings
router.get("/public-settings", protect, getPublicSettings);
router.put("/public-settings", protect, upsertPublicSettings);

export default router;
