import PlatformProfile from "../models/PlatformProfile.js";
import PublicProfileSettings from "../models/PublicProfileSettings.js";
import { requireString, optionalNumber, requireBoolean, safeEnum } from "../utils/validation.js";
import { syncPlatformProfile } from "../services/platformSyncService.js";
import { computeAggregatedStats } from "../services/profileAggregationService.js";

const PLATFORMS = [
  "leetcode",
  "codeforces",
  "codechef",
  "atcoder",
  "hackerrank",
  "custom",
];

export async function addPlatformProfile(req, res) {
  try {
    const userId = req.user._id;
    const platform = safeEnum(req.body?.platform, "platform", PLATFORMS);
    const profileUrl = requireString(req.body?.profileUrl, "profileUrl", { max: 500 });
    const handle = requireString(req.body?.handle, "handle", { max: 60 });

    const doc = await PlatformProfile.create({
      userId,
      platform,
      profileUrl,
      handle,
      isEnabled: true,
      visibility: "private",
      syncStatus: "pending",
    });

    // Fire-and-forget sync
    syncPlatformProfile(doc._id)
      .then(() => computeAggregatedStats(userId))
      .catch(() => {
        // ignore
      });

    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || "Failed" });
  }
}

export async function getPlatformProfiles(req, res) {
  try {
    const userId = req.user._id;
    const platforms = await PlatformProfile.find({ userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: platforms });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to load platforms" });
  }
}

export async function updatePlatformProfile(req, res) {
  try {
    const userId = req.user._id;
    const id = req.params.id;

    const patch = {};
    if (req.body?.profileUrl !== undefined) {
      patch.profileUrl = requireString(req.body.profileUrl, "profileUrl", { max: 500 });
    }
    if (req.body?.handle !== undefined) {
      patch.handle = requireString(req.body.handle, "handle", { max: 60 });
    }
    if (req.body?.isEnabled !== undefined) {
      patch.isEnabled = requireBoolean(req.body.isEnabled, "isEnabled");
    }
    if (req.body?.visibility !== undefined) {
      patch.visibility = safeEnum(req.body.visibility, "visibility", ["public", "private"]);
    }

    const updated = await PlatformProfile.findOneAndUpdate(
      { _id: id, userId },
      { $set: patch },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Platform profile not found" });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || "Failed" });
  }
}

export async function syncPlatform(req, res) {
  try {
    const userId = req.user._id;
    const id = req.params.id;

    const profile = await PlatformProfile.findOne({ _id: id, userId });
    if (!profile) {
      return res.status(404).json({ success: false, message: "Platform profile not found" });
    }

    await syncPlatformProfile(profile._id);
    await computeAggregatedStats(userId);

    res.json({ success: true, message: "Synced" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Sync failed" });
  }
}

export async function getPublicSettings(req, res) {
  try {
    const userId = req.user._id;
    const doc = await PublicProfileSettings.findOne({ userId });
    res.json({ success: true, data: doc || null });
  } catch {
    res.status(500).json({ success: false, message: "Failed" });
  }
}

export async function upsertPublicSettings(req, res) {
  try {
    const userId = req.user._id;

    const patch = {};
    if (req.body?.isPublic !== undefined) patch.isPublic = requireBoolean(req.body.isPublic, "isPublic");
    if (req.body?.publicUsername !== undefined) {
      patch.publicUsername = requireString(req.body.publicUsername, "publicUsername", { max: 30 }).toLowerCase();
    }
    if (req.body?.showPlatforms !== undefined) patch.showPlatforms = requireBoolean(req.body.showPlatforms, "showPlatforms");
    if (req.body?.showDifficulty !== undefined) patch.showDifficulty = requireBoolean(req.body.showDifficulty, "showDifficulty");
    if (req.body?.showSkills !== undefined) patch.showSkills = requireBoolean(req.body.showSkills, "showSkills");
    if (req.body?.showTrends !== undefined) patch.showTrends = requireBoolean(req.body.showTrends, "showTrends");

    const doc = await PublicProfileSettings.findOneAndUpdate(
      { userId },
      { $set: patch },
      { upsert: true, new: true }
    );

    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || "Failed" });
  }
}
