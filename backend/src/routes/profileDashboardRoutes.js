import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  addPlatformProfile,
  getPlatformProfiles,
  updatePlatformProfile,
  syncPlatform,
  getPublicSettings,
  upsertPublicSettings,
} from "../controllers/profileDashboardController.js";

const router = express.Router();

router.post("/platform", protect, addPlatformProfile);
router.get("/platforms", protect, getPlatformProfiles);
router.put("/platform/:id", protect, updatePlatformProfile);
router.post("/platform/:id/sync", protect, syncPlatform);

router.get("/public-settings", protect, getPublicSettings);
router.put("/public-settings", protect, upsertPublicSettings);

export default router;
