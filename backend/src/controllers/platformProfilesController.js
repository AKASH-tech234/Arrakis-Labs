import PlatformProfile from "../models/PlatformProfile.js";
import PublicProfileSettings from "../models/PublicProfileSettings.js";

const PLATFORMS = [
  "leetcode",
  "codeforces",
  "codechef",
  "atcoder",
  "hackerrank",
  "custom",
];

function asString(v) {
  if (v === undefined || v === null) return null;
  return String(v);
}

function requireString(v, field, { max } = {}) {
  const s = asString(v);
  if (!s || !s.trim()) throw new Error(`${field} is required`);
  if (max && s.length > max) throw new Error(`${field} is too long`);
  return s.trim();
}

function optionalString(v, { max } = {}) {
  if (v === undefined) return undefined;
  const s = asString(v);
  if (s === null) return null;
  const t = s.trim();
  if (!t) return null;
  if (max && t.length > max) throw new Error("Value is too long");
  return t;
}

function optionalBoolean(v) {
  if (v === undefined) return undefined;
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  throw new Error("Invalid boolean");
}

function requireEnum(v, field, allowed) {
  const s = requireString(v, field, { max: 50 }).toLowerCase();
  if (!allowed.includes(s)) throw new Error(`${field} must be one of: ${allowed.join(", ")}`);
  return s;
}

export async function listPlatformProfiles(req, res) {
  try {
    const userId = req.user._id;
    const platforms = await PlatformProfile.find({ userId }).sort({ createdAt: -1 });
    return res.json({ success: true, data: platforms });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed" });
  }
}

export async function addPlatformProfile(req, res) {
  try {
    const userId = req.user._id;
    const platform = requireEnum(req.body?.platform, "platform", PLATFORMS);
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

    return res.status(201).json({ success: true, data: doc });
  } catch (err) {
    const message = err?.message || "Failed";
    const isDup = message.includes("duplicate key") || message.includes("E11000");
    return res.status(isDup ? 409 : 400).json({ success: false, message });
  }
}

export async function updatePlatformProfile(req, res) {
  try {
    const userId = req.user._id;
    const id = req.params.id;

    const patch = {};
    if (req.body?.profileUrl !== undefined) {
      patch.profileUrl = optionalString(req.body.profileUrl, { max: 500 }) ?? "";
    }
    if (req.body?.handle !== undefined) {
      patch.handle = optionalString(req.body.handle, { max: 60 }) ?? "";
    }
    if (req.body?.isEnabled !== undefined) {
      patch.isEnabled = optionalBoolean(req.body.isEnabled);
    }
    if (req.body?.visibility !== undefined) {
      patch.visibility = requireEnum(req.body.visibility, "visibility", ["public", "private"]);
    }

    const updated = await PlatformProfile.findOneAndUpdate(
      { _id: id, userId },
      { $set: patch },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Platform profile not found" });
    }

    return res.json({ success: true, data: updated });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || "Failed" });
  }
}

export async function getPublicSettings(req, res) {
  try {
    const userId = req.user._id;
    const doc = await PublicProfileSettings.findOne({ userId }).lean();
    return res.json({ success: true, data: doc || null });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed" });
  }
}

export async function upsertPublicSettings(req, res) {
  try {
    const userId = req.user._id;

    const patch = {};
    if (req.body?.isPublic !== undefined) patch.isPublic = optionalBoolean(req.body.isPublic);
    if (req.body?.publicUsername !== undefined) {
      const u = optionalString(req.body.publicUsername, { max: 30 });
      patch.publicUsername = u ? u.toLowerCase() : null;
    }
    if (req.body?.showPlatforms !== undefined) patch.showPlatforms = optionalBoolean(req.body.showPlatforms);
    if (req.body?.showDifficulty !== undefined) patch.showDifficulty = optionalBoolean(req.body.showDifficulty);
    if (req.body?.showSkills !== undefined) patch.showSkills = optionalBoolean(req.body.showSkills);
    if (req.body?.showTrends !== undefined) patch.showTrends = optionalBoolean(req.body.showTrends);

    const doc = await PublicProfileSettings.findOneAndUpdate(
      { userId },
      { $set: patch },
      { upsert: true, new: true }
    );

    return res.json({ success: true, data: doc });
  } catch (err) {
    const message = err?.message || "Failed";
    const isDup = message.includes("duplicate key") || message.includes("E11000");
    return res.status(isDup ? 409 : 400).json({ success: false, message });
  }
}
