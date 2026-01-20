import PlatformStats from "../models/PlatformStats.js";
import AggregatedStats from "../models/AggregatedStats.js";
import PlatformProfile from "../models/PlatformProfile.js";
import PublicProfileSettings from "../models/PublicProfileSettings.js";
import { computeAggregatedStats } from "../services/profileAggregationService.js";

async function canAccessUserStats(requestingUser, userId) {
  if (requestingUser && String(requestingUser._id) === String(userId)) return true;
  const settings = await PublicProfileSettings.findOne({ userId }).lean();
  return !!settings?.isPublic;
}

export async function getCombined(req, res) {
  try {
    const userId = req.query.userId || req.user?._id;
    if (!userId) {
      return res.status(400).json({ success: false, message: "userId required" });
    }

    const ok = await canAccessUserStats(req.user, userId);
    if (!ok) return res.status(403).json({ success: false, message: "Profile is private" });

    const agg = await computeAggregatedStats(userId);
    res.json({ success: true, data: agg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed" });
  }
}

export async function getPlatform(req, res) {
  try {
    const platform = req.params.platform;
    const userId = req.query.userId || req.user?._id;

    if (!userId) {
      return res.status(400).json({ success: false, message: "userId required" });
    }

    const ok = await canAccessUserStats(req.user, userId);
    if (!ok) return res.status(403).json({ success: false, message: "Profile is private" });

    const stats = await PlatformStats.findOne({ userId, platform }).lean();
    res.json({ success: true, data: stats || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed" });
  }
}

export async function getDifficulty(req, res) {
  try {
    const userId = req.query.userId || req.user?._id;
    if (!userId) {
      return res.status(400).json({ success: false, message: "userId required" });
    }

    const ok = await canAccessUserStats(req.user, userId);
    if (!ok) return res.status(403).json({ success: false, message: "Profile is private" });

    const agg = await computeAggregatedStats(userId);
    res.json({ success: true, data: agg?.difficulty || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed" });
  }
}

export async function getSkills(req, res) {
  try {
    const userId = req.query.userId || req.user?._id;
    if (!userId) {
      return res.status(400).json({ success: false, message: "userId required" });
    }

    const ok = await canAccessUserStats(req.user, userId);
    if (!ok) return res.status(403).json({ success: false, message: "Profile is private" });

    const agg = await computeAggregatedStats(userId);
    res.json({ success: true, data: agg?.skills || {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed" });
  }
}

export async function getPlatformsWithStats(req, res) {
  try {
    const userId = req.user._id;
    const profiles = await PlatformProfile.find({ userId }).lean();
    const stats = await PlatformStats.find({ userId }).lean();

    const statsMap = new Map(stats.map((s) => [s.platform, s]));

    const merged = profiles.map((p) => ({
      ...p,
      stats: statsMap.get(p.platform) || null,
    }));

    res.json({ success: true, data: merged });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed" });
  }
}
