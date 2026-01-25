import express from "express";
import { optionalAuth } from "../../middleware/auth/authMiddleware.js";
import {
  getContestHistory,
  getContestStats,
  getContestRating,
} from "../../controllers/contest/contestProfileController.js";

const router = express.Router();

// These endpoints are intentionally read-only and safe for public profiles.
// Access control is enforced inside the controller via PublicProfileSettings.
router.get("/history", optionalAuth, getContestHistory);
router.get("/stats", optionalAuth, getContestStats);
router.get("/rating", optionalAuth, getContestRating);

export default router;
