import ContestRegistration from "../../models/contest/ContestRegistration.js";
import PublicProfileSettings from "../../models/profile/PublicProfileSettings.js";

function normalizeUsername(username) {
  return String(username || "").toLowerCase().trim();
}

async function resolveTargetUserId({ requestingUser, userId, username }) {
  if (userId) return String(userId);

  const normalizedUsername = normalizeUsername(username);
  if (normalizedUsername) {
    const settings = await PublicProfileSettings.findOne({
      publicUsername: normalizedUsername,
      isPublic: true,
    }).lean();
    return settings?.userId ? String(settings.userId) : null;
  }

  return requestingUser?._id ? String(requestingUser._id) : null;
}

async function canAccessUserContests({ requestingUser, userId, username }) {
  if (requestingUser && String(requestingUser._id) === String(userId)) return true;

  // If accessed by public username, we already enforced isPublic in resolveTargetUserId.
  if (normalizeUsername(username)) return true;

  const settings = await PublicProfileSettings.findOne({ userId }).lean();
  return !!settings?.isPublic;
}

function mapRegistration(reg) {
  const contest = reg.contest;
  return {
    contestId: contest?._id,
    contestName: contest?.name,
    contestSlug: contest?.slug,
    startTime: contest?.startTime,
    endTime: contest?.endTime,
    contestStatus: contest?.status,
    rankingType: contest?.rankingType,

    registrationStatus: reg.status,
    registeredAt: reg.registeredAt,
    joinedAt: reg.joinedAt,

    finalRank: reg.finalRank,
    finalScore: reg.finalScore,
    problemsSolved: reg.problemsSolved,
    totalTime: reg.totalTime,
    totalPenalty: reg.totalPenalty,

    ratingBefore: reg.ratingBefore,
    ratingAfter: reg.ratingAfter,
    ratingChange: reg.ratingChange,
  };
}

function computeBestRank(history) {
  const ranks = history
    .map((h) => h.finalRank)
    .filter((r) => Number.isFinite(r));
  return ranks.length ? Math.min(...ranks) : null;
}

function computePlatformCounts(history) {
  // Internal contests are part of Arrakis; keep the shape platform->count.
  return {
    arrakis: history.length,
  };
}

export async function getContestHistory(req, res) {
  try {
    const userId = await resolveTargetUserId({
      requestingUser: req.user,
      userId: req.query.userId,
      username: req.query.username,
    });

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId or username required (or login)",
      });
    }

    const ok = await canAccessUserContests({
      requestingUser: req.user,
      userId,
      username: req.query.username,
    });

    if (!ok) {
      return res.status(403).json({ success: false, message: "Profile is private" });
    }

    const regs = await ContestRegistration.find({ user: userId })
      .populate("contest", "name slug startTime endTime status rankingType")
      .sort({ registeredAt: -1 })
      .lean();

    const history = (regs || []).map(mapRegistration);

    return res.json({ success: true, data: { history } });
  } catch (err) {
    console.warn("[ContestProfile] history fetch failed:", err?.message);
    return res.status(500).json({ success: false, message: err.message || "Failed" });
  }
}

export async function getContestStats(req, res) {
  try {
    const userId = await resolveTargetUserId({
      requestingUser: req.user,
      userId: req.query.userId,
      username: req.query.username,
    });

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId or username required (or login)",
      });
    }

    const ok = await canAccessUserContests({
      requestingUser: req.user,
      userId,
      username: req.query.username,
    });

    if (!ok) {
      return res.status(403).json({ success: false, message: "Profile is private" });
    }

    const regs = await ContestRegistration.find({ user: userId })
      .populate("contest", "name slug startTime endTime status rankingType")
      .sort({ registeredAt: -1 })
      .lean();

    const history = (regs || []).map(mapRegistration);

    const bestRank = computeBestRank(history);
    const platformCounts = computePlatformCounts(history);

    const bestContest = history
      .filter((h) => Number.isFinite(h.finalRank))
      .sort((a, b) => (a.finalRank ?? Number.MAX_SAFE_INTEGER) - (b.finalRank ?? Number.MAX_SAFE_INTEGER))[0];

    const recent = history.slice(0, 10);

    return res.json({
      success: true,
      data: {
        totalContests: history.length,
        platformCounts,
        bestRank,
        bestContest: bestContest || null,
        recent,
      },
    });
  } catch (err) {
    console.warn("[ContestProfile] stats fetch failed:", err?.message);
    return res.status(500).json({ success: false, message: err.message || "Failed" });
  }
}

export async function getContestRating(req, res) {
  try {
    const userId = await resolveTargetUserId({
      requestingUser: req.user,
      userId: req.query.userId,
      username: req.query.username,
    });

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId or username required (or login)",
      });
    }

    const ok = await canAccessUserContests({
      requestingUser: req.user,
      userId,
      username: req.query.username,
    });

    if (!ok) {
      return res.status(403).json({ success: false, message: "Profile is private" });
    }

    const regs = await ContestRegistration.find({ user: userId })
      .populate("contest", "name slug startTime endTime status")
      .sort({ registeredAt: 1 })
      .lean();

    const points = (regs || [])
      .map((reg) => {
        const contest = reg.contest;
        const date = contest?.endTime || contest?.startTime || reg.registeredAt;
        return {
          date,
          contestName: contest?.name,
          contestId: contest?._id,
          contestSlug: contest?.slug,
          ratingBefore: reg.ratingBefore,
          ratingAfter: reg.ratingAfter,
          ratingChange: reg.ratingChange,
        };
      })
      // Only keep meaningful rating points
      .filter((p) => p.date);

    return res.json({ success: true, data: { points } });
  } catch (err) {
    console.warn("[ContestProfile] rating fetch failed:", err?.message);
    return res.status(500).json({ success: false, message: err.message || "Failed" });
  }
}
