import PlatformProfile from "../models/PlatformProfile.js";
import PlatformStats from "../models/PlatformStats.js";

function strengthLevel(solved) {
  if (solved >= 30) return "Strong";
  if (solved >= 10) return "Intermediate";
  return "Beginner";
}

function emptyDifficulty() {
  return {
    easy: { solved: 0, attempted: 0 },
    medium: { solved: 0, attempted: 0 },
    hard: { solved: 0, attempted: 0 },
  };
}

export async function syncPlatformProfile(platformProfileId) {
  const profile = await PlatformProfile.findById(platformProfileId);
  if (!profile) throw new Error("Platform profile not found");

  if (!profile.isEnabled) {
    return { skipped: true, reason: "disabled" };
  }

  profile.syncStatus = "syncing";
  profile.lastSyncError = null;
  await profile.save();

  try {
    // External fetching/scraping is disabled by policy.
    // This endpoint is kept for API compatibility, but does not reach out to external services
    // and does not write placeholder/dummy stats.

    const existing = await PlatformStats.findOne({ userId: profile.userId, platform: profile.platform }).lean();

    profile.syncStatus = existing ? "success" : "error";
    profile.lastSyncAt = new Date();
    profile.lastSyncError = existing
      ? null
      : "External sync disabled. Stats must already exist in DB.";
    await profile.save();

    return { skipped: true, platform: profile.platform, reason: "external_sync_disabled" };
  } catch (err) {
    profile.syncStatus = "error";
    profile.lastSyncError = err?.message || "Sync failed";
    profile.lastSyncAt = new Date();
    await profile.save();

    throw err;
  }
}
