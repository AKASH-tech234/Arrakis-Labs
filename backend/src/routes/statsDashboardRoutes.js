import express from "express";
import { optionalAuth, protect } from "../middleware/authMiddleware.js";
import {
  getCombined,
  getPlatform,
  getSkills,
  getDifficulty,
  getPlatformsWithStats,
} from "../controllers/statsDashboardController.js";

const router = express.Router();

router.get("/combined", optionalAuth, getCombined);
router.get("/platform/:platform", optionalAuth, getPlatform);
router.get("/skills", optionalAuth, getSkills);
router.get("/difficulty", optionalAuth, getDifficulty);

// authenticated helper for dashboard
router.get("/me/platforms", protect, getPlatformsWithStats);

export default router;
