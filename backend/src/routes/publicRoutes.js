import express from "express";
import { optionalAuth } from "../middleware/authMiddleware.js";
import { getProfileAnalytics } from "../controllers/profileAnalyticsController.js";

const router = express.Router();

router.get("/:username", optionalAuth, (req, res, next) => {
  req.query = req.query || {};
  req.query.username = req.params.username;
  return getProfileAnalytics(req, res, next);
});

export default router;
