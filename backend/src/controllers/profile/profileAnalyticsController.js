import mongoose from "mongoose";
import User from "../../models/auth/User.js";
import Submission from "../../models/profile/Submission.js";
import Question from "../../models/question/Question.js";
import PublicProfileSettings from "../../models/profile/PublicProfileSettings.js";
import PlatformProfile from "../../models/profile/PlatformProfile.js";
import PlatformStats from "../../models/profile/PlatformStats.js";
import { computeAggregatedStats } from "../../services/profile/profileAggregationService.js";

const CATEGORY_ORDER = [
  "Arrays",
  "Strings",
  "Math",
  "Linked List",
  "Binary Search",
  "Recursion",
];

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function startOfUtcDay(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function pickCategoriesFromTags(tags = []) {
  const normalized = tags.map((t) => String(t).toLowerCase());

  const matches = new Set();
  for (const tag of normalized) {
    if (tag.includes("array")) matches.add("Arrays");
    if (tag.includes("string")) matches.add("Strings");
    if (tag.includes("math")) matches.add("Math");
    if (tag.includes("linked")) matches.add("Linked List");
    if (tag.includes("binary search") || tag.includes("binary")) matches.add("Binary Search");
    if (tag.includes("recursion")) matches.add("Recursion");
  }

  return matches.size ? Array.from(matches) : [];
}

function displaySubmissionStatus(status) {
  switch (status) {
    case "accepted":
      return "Accepted";
    case "wrong_answer":
      return "Wrong Answer";
    case "time_limit_exceeded":
      return "Time Limit";
    case "memory_limit_exceeded":
      return "Memory Limit";
    case "runtime_error":
      return "Runtime Error";
    case "compile_error":
      return "Compile Error";
    case "pending":
      return "Pending";
    case "running":
      return "Running";
    default:
      return "Error";
  }
}

function computeStreaksFromDailyActivity(dailyActivity = []) {
  if (!Array.isArray(dailyActivity) || dailyActivity.length === 0) {
    return { currentStreak: 0, maxStreak: 0 };
  }

  const todayKey = isoDate(startOfUtcDay(new Date()));

  const indexByDate = new Map(dailyActivity.map((d, idx) => [d.date, idx]));
  const todayIndex = indexByDate.get(todayKey);

  let currentStreak = 0;
  if (Number.isInteger(todayIndex)) {
    for (let i = todayIndex; i >= 0; i--) {
      if ((dailyActivity[i]?.count || 0) > 0) currentStreak += 1;
      else break;
    }
  }

  let maxStreak = 0;
  let run = 0;
  for (const d of dailyActivity) {
    if ((d.count || 0) > 0) {
      run += 1;
      if (run > maxStreak) maxStreak = run;
    } else {
      run = 0;
    }
  }

  return { currentStreak, maxStreak };
}

async function resolveUserForRequest({ requestingUser, username, userId }) {
  if (userId) {
    const user = await User.findById(userId).lean();
    return user || null;
  }

  if (username) {
    const settings = await PublicProfileSettings.findOne({ publicUsername: username.toLowerCase() }).lean();
    if (!settings?.userId) return null;

    if (!settings.isPublic) {
      if (requestingUser && String(requestingUser._id) === String(settings.userId)) {
        const user = await User.findById(settings.userId).lean();
        if (!user) return null;
        return { user, settings };
      }
      return { forbidden: true };
    }

    const user = await User.findById(settings.userId).lean();
    if (!user) return null;

    return { user, settings };
  }

  if (requestingUser?._id) {
    const user = await User.findById(requestingUser._id).lean();
    return user || null;
  }

  return null;
}

export async function getProfileAnalytics(req, res) {
  try {
    const username = req.query?.username;
    const userId = req.query?.userId;

    const resolved = await resolveUserForRequest({ requestingUser: req.user, username, userId });
    if (!resolved) return res.status(404).json({ success: false, message: "User not found" });
    if (resolved?.forbidden) return res.status(403).json({ success: false, message: "Profile is private" });

    const user = resolved.user || resolved;

    const agg = await computeAggregatedStats(user._id);

    const totalProblems = await Question.countDocuments({ isActive: true });

    const [counts] = await Submission.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(user._id),
          isRun: false,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          accepted: {
            $sum: {
              $cond: [{ $eq: ["$status", "accepted"] }, 1, 0],
            },
          },
        },
      },
    ]);

    const totalSubs = counts?.total || 0;
    const acceptedSubs = counts?.accepted || 0;
    const acceptanceRate = totalSubs > 0 ? Number(((acceptedSubs / totalSubs) * 100).toFixed(1)) : 0;

    const solvedIds = await Submission.distinct("questionId", {
      userId: user._id,
      isRun: false,
      status: "accepted",
    });

    const solvedQuestions = await Question.find({ _id: { $in: solvedIds } }).select("difficulty tags").lean();

    const easyCount = solvedQuestions.filter((q) => q.difficulty === "Easy").length;
    const mediumCount = solvedQuestions.filter((q) => q.difficulty === "Medium").length;
    const hardCount = solvedQuestions.filter((q) => q.difficulty === "Hard").length;

    const attemptedIds = await Submission.distinct("questionId", {
      userId: user._id,
      isRun: false,
    });

    const attemptedQuestions = await Question.find({ _id: { $in: attemptedIds } }).select("tags").lean();

    const categoryAgg = new Map(CATEGORY_ORDER.map((c) => [c, { solved: 0, total: 0 }]));

    for (const q of attemptedQuestions) {
      for (const c of pickCategoriesFromTags(q.tags || [])) {
        const prev = categoryAgg.get(c) || { solved: 0, total: 0 };
        prev.total += 1;
        categoryAgg.set(c, prev);
      }
    }

    for (const q of solvedQuestions) {
      for (const c of pickCategoriesFromTags(q.tags || [])) {
        const prev = categoryAgg.get(c) || { solved: 0, total: 0 };
        prev.solved += 1;
        categoryAgg.set(c, prev);
      }
    }

    const categories = CATEGORY_ORDER.map((name) => ({ name, ...categoryAgg.get(name) }));

    const recent = await Submission.find({ userId: user._id, isRun: false })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate({ path: "questionId", select: "title" })
      .lean();

    const recentSubmissions = recent.map((s) => ({
      id: String(s._id),
      problem: s.questionId?.title || "Unknown",
      status: displaySubmissionStatus(s.status),
      createdAt: s.createdAt,
      executionTime: s.totalExecutionTime,
    }));

    const { currentStreak, maxStreak } = computeStreaksFromDailyActivity(agg?.dailyActivity || []);

    const settings =
      resolved.settings || (await PublicProfileSettings.findOne({ userId: user._id }).lean());

    const publicUsername = settings?.publicUsername || null;
    const usernameDerived = publicUsername || String(user.email || "").split("@")[0] || String(user._id);

    const descriptor = currentStreak > 0 ? `On a ${currentStreak}-day streak` : "No streak yet";

    const platforms = await PlatformProfile.find({ userId: user._id }).lean();
    const platformStats = await PlatformStats.find({ userId: user._id }).lean();
    const statsMap = new Map(platformStats.map((s) => [s.platform, s]));

    const platformsWithStats = platforms.map((p) => ({
      ...p,
      stats: statsMap.get(p.platform) || null,
    }));

    return res.json({
      success: true,
      data: {
        user: {
          name: user.name,
          username: usernameDerived,
          profileImage: user.profileImage,
          descriptor,
          memberSince: user.createdAt ? String(new Date(user.createdAt).getFullYear()) : "-",
        },
        overview: {
          problemsSolved: solvedIds.length,
          totalProblems,
          acceptanceRate,
          currentStreak,
          maxStreak,
          easyCount,
          mediumCount,
          hardCount,
        },
        activity: agg?.dailyActivity || [],
        combined: agg,
        categories,
        recentSubmissions,
        platforms: platformsWithStats,
        publicSettings: settings || null,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed" });
  }
}
