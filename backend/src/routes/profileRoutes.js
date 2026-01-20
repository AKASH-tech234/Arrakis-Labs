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

const router = express.Router();

// Analytics (supports both my profile and public username lookups)
router.get("/analytics", optionalAuth, getProfileAnalytics);

// Platform aggregation settings
router.get("/platforms", protect, listPlatformProfiles);
router.post("/platform", protect, addPlatformProfile);
router.put("/platform/:id", protect, updatePlatformProfile);

// Public profile settings
router.get("/public-settings", protect, getPublicSettings);
router.put("/public-settings", protect, upsertPublicSettings);

export default router;
