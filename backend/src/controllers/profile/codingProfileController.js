import User from "../../models/auth/User.js";
import PlatformProfile from "../../models/profile/PlatformProfile.js";
import PlatformStats from "../../models/profile/PlatformStats.js";
import { computeAggregatedStats } from "../../services/profile/profileAggregationService.js";
import { syncPlatformProfile } from "../../services/profile/platformSyncService.js";

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function normalizeUserName(user) {
  const emailPrefix = String(user?.email || "").split("@")[0];
  return {
    name: user?.name || "—",
    username: user?.username || emailPrefix || String(user?._id || "—"),
    profileImage: user?.profileImage || null,
    memberSince: user?.createdAt ? String(new Date(user.createdAt).getFullYear()) : "-",
  };
}

function toHeatmapSeries({ internalDailyActivity, externalDailySeriesByPlatform }) {
  const combined = new Map();

  if (Array.isArray(internalDailyActivity)) {
    for (const d of internalDailyActivity) {
      if (!d?.date) continue;
      combined.set(d.date, (combined.get(d.date) || 0) + (d.count || 0));
    }
  }

  for (const series of Object.values(externalDailySeriesByPlatform || {})) {
    if (!Array.isArray(series)) continue;
    for (const d of series) {
      if (!d?.date) continue;
      combined.set(d.date, (combined.get(d.date) || 0) + (d.count || 0));
    }
  }

  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - 364);

  const out = [];
  for (let i = 0; i < 365; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const key = isoDate(d);
    out.push({ date: key, count: combined.get(key) || 0 });
  }
  return out;
}

function pickRating(stats) {
  if (!stats) return null;
  const r = Number.isFinite(stats.currentRating) ? stats.currentRating : null;
  if (r !== null) return r;
  return Number.isFinite(stats.highestRating) ? stats.highestRating : null;
}

function statsErrorCode({ profile, stats }) {
  if (profile?.syncStatus === "error") return "FETCH_FAILED";
  if (!stats) return "NO_STATS";
  return null;
}

function toDailyCountSeries(stats) {
  const daily = Array.isArray(stats?.daily) ? stats.daily : [];
  
  return daily
    .filter((d) => d?.date)
    .map((d) => ({ date: d.date, count: d.solved || 0 }));
}

export async function deletePlatformProfile(req, res) {
  try {
    const userId = req.user._id;
    const id = req.params.id;

    const deleted = await PlatformProfile.findOneAndDelete({ _id: id, userId });
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Platform profile not found" });
    }

    await PlatformStats.deleteOne({ userId, platform: deleted.platform });

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed" });
  }
}

export async function syncPlatformProfileHandler(req, res) {
  try {
    const userId = req.user._id;
    const id = req.params.id;

    const profile = await PlatformProfile.findOne({ _id: id, userId }).lean();
    if (!profile) {
      return res.status(404).json({ success: false, message: "Platform profile not found" });
    }

    const result = await syncPlatformProfile(id);
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || "Failed" });
  }
}

export async function getCodingProfileSummary(req, res) {
  try {
    const userId = req.user._id;

    const agg = await computeAggregatedStats(userId);

    const user = await User.findById(userId).lean();

    const profiles = await PlatformProfile.find({ userId }).sort({ createdAt: -1 }).lean();
    const stats = await PlatformStats.find({ userId }).lean();
    const statsByPlatform = new Map(stats.map((s) => [s.platform, s]));

    const arrakisStats = statsByPlatform.get("arrakis") || null;

    const externalDailySeriesByPlatform = {};
    const platforms = profiles.map((p) => {
      const s = statsByPlatform.get(p.platform) || null;

      externalDailySeriesByPlatform[p.platform] = s ? toDailyCountSeries(s) : [];

      const error = statsErrorCode({ profile: p, stats: s });

      const shouldProvidePlaceholderStats = p.platform === "codechef";

      const normalizedStats = s
        ? {
            totalSolved: s.totalSolved ?? null,
            solved: s.totalSolved ?? null,
            rating: pickRating(s),
            lastSyncedAt: s.lastSyncedAt || null,
            error,
          }
        : shouldProvidePlaceholderStats
          ? {
              totalSolved: 0,
              solved: 0,
              rating: null,
              lastSyncedAt: null,
              error,
            }
          : null;

      return {
        id: String(p._id),
        platform: p.platform,
        handle: p.handle,
        profileUrl: p.profileUrl,
        isEnabled: p.isEnabled,
        visibility: p.visibility,
        syncStatus: p.syncStatus,
        lastSyncAt: p.lastSyncAt,
        lastSyncError: p.lastSyncError,
        stats: normalizedStats,
        activity: s ? toDailyCountSeries(s).slice(-365) : [],
      };
    });

    const internal = {
      platform: "arrakis",
      stats: arrakisStats
        ? {
            totalSolved: arrakisStats.totalSolved ?? 0,
            rating: pickRating(arrakisStats),
            lastSyncedAt: arrakisStats.lastSyncedAt || null,
          }
        : { totalSolved: 0, rating: null, lastSyncedAt: null },
      activity: Array.isArray(agg?.dailyActivity) ? agg.dailyActivity.slice(-365) : [],
    };

    const combinedPlatformsForTotals = [internal, ...platforms]
      .map((p) => ({ platform: p.platform, stats: p.stats }))
      .filter((p) => p.stats);

    const combinedTotalSolved = combinedPlatformsForTotals.reduce(
      (sum, p) => sum + (p.stats.totalSolved || 0),
      0
    );

    const ratings = [internal, ...platforms]
      .map((p) => p.stats?.rating)
      .filter((r) => Number.isFinite(r));
    const bestRating = ratings.length ? Math.max(...ratings) : null;

    const contributions = [internal, ...platforms]
      .filter((p) => p.stats)
      .map((p) => ({
        platform: p.platform,
        totalSolved: p.stats?.totalSolved ?? 0,
        rating: p.stats?.rating ?? null,
      }));

    const combinedActivity = toHeatmapSeries({
      internalDailyActivity: Array.isArray(agg?.dailyActivity) ? agg.dailyActivity : [],
      externalDailySeriesByPlatform,
    });

    return res.json({
      success: true,
      data: {
        user: normalizeUserName(user),
        internal,
        platforms: Array.isArray(platforms) ? platforms : [],
        totalSolved: Number.isFinite(combinedTotalSolved) ? combinedTotalSolved : 0,
        activity: Array.isArray(combinedActivity) ? combinedActivity : [],
        combined: {
          totalSolved: combinedTotalSolved,
          bestRating,
          contributions,
          activity: combinedActivity,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed" });
  }
}
