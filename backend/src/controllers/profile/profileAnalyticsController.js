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
  "Dynamic Programming",
  "Two Pointers",
  "Hash Table",
  "Tree",
  "Graph",
  "Sorting",
  "Greedy",
  "Stack",
  "Queue",
];

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function startOfUtcDay(d) {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function pickCategoriesFromQuestion(question) {
  const matches = new Set();
  
  // Check categoryType field first (primary source)
  if (question.categoryType) {
    const catType = String(question.categoryType).trim();
    // Try to match with CATEGORY_ORDER
    const matchedCat = CATEGORY_ORDER.find(
      c => c.toLowerCase() === catType.toLowerCase()
    );
    if (matchedCat) {
      matches.add(matchedCat);
    } else {
      // Add as-is if it's a valid category name
      matches.add(catType);
    }
  }
  
  // Check topic field
  if (question.topic) {
    const topic = String(question.topic).trim();
    const matchedTopic = CATEGORY_ORDER.find(
      c => c.toLowerCase() === topic.toLowerCase()
    );
    if (matchedTopic) {
      matches.add(matchedTopic);
    }
  }
  
  // Also check tags for additional categories
  const tags = question.tags || [];
  const normalized = tags.map((t) => String(t).toLowerCase().trim());

  for (const tag of normalized) {
    if (tag.includes("array")) matches.add("Arrays");
    if (tag.includes("string")) matches.add("Strings");
    if (tag.includes("math")) matches.add("Math");
    if (tag.includes("linked")) matches.add("Linked List");
    if (tag.includes("binary search")) matches.add("Binary Search");
    if (tag.includes("recursion") || tag.includes("recursive")) matches.add("Recursion");
    if (tag.includes("dynamic") || tag.includes("dp")) matches.add("Dynamic Programming");
    if (tag.includes("two pointer")) matches.add("Two Pointers");
    if (tag.includes("hash")) matches.add("Hash Table");
    if (tag.includes("tree")) matches.add("Tree");
    if (tag.includes("graph")) matches.add("Graph");
    if (tag.includes("sort")) matches.add("Sorting");
    if (tag.includes("greedy")) matches.add("Greedy");
    if (tag.includes("stack")) matches.add("Stack");
    if (tag.includes("queue")) matches.add("Queue");
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
    const settings = await PublicProfileSettings.findOne({
      publicUsername: username.toLowerCase(),
    }).lean();
    if (!settings?.userId) return null;

    if (!settings.isPublic) {
      if (
        requestingUser &&
        String(requestingUser._id) === String(settings.userId)
      ) {
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

    const resolved = await resolveUserForRequest({
      requestingUser: req.user,
      username,
      userId,
    });
    if (!resolved)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    if (resolved?.forbidden)
      return res
        .status(403)
        .json({ success: false, message: "Profile is private" });

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
    const acceptanceRate =
      totalSubs > 0 ? Number(((acceptedSubs / totalSubs) * 100).toFixed(1)) : 0;

    const solvedIds = await Submission.distinct("questionId", {
      userId: user._id,
      isRun: false,
      status: "accepted",
    });

    const solvedQuestions = await Question.find({ _id: { $in: solvedIds } })
      .select("difficulty tags categoryType topic")
      .lean();

    const easyCount = solvedQuestions.filter(
      (q) => q.difficulty === "Easy",
    ).length;
    const mediumCount = solvedQuestions.filter(
      (q) => q.difficulty === "Medium",
    ).length;
    const hardCount = solvedQuestions.filter(
      (q) => q.difficulty === "Hard",
    ).length;

    const attemptedIds = await Submission.distinct("questionId", {
      userId: user._id,
      isRun: false,
    });

    const attemptedQuestions = await Question.find({
      _id: { $in: attemptedIds },
    })
      .select("tags categoryType topic")
      .lean();

    const categoryAgg = new Map(
      CATEGORY_ORDER.map((c) => [c, { solved: 0, total: 0 }]),
    );

    for (const q of attemptedQuestions) {
      const cats = pickCategoriesFromQuestion(q);
      for (const c of cats) {
        const prev = categoryAgg.get(c) || { solved: 0, total: 0 };
        prev.total += 1;
        categoryAgg.set(c, prev);
      }
    }

    for (const q of solvedQuestions) {
      const cats = pickCategoriesFromQuestion(q);
      for (const c of cats) {
        const prev = categoryAgg.get(c) || { solved: 0, total: 0 };
        prev.solved += 1;
        categoryAgg.set(c, prev);
      }
    }

    // Filter out categories with no activity and sort by total
    const categories = CATEGORY_ORDER
      .map((name) => ({
        name,
        ...(categoryAgg.get(name) || { solved: 0, total: 0 }),
      }))
      .filter((c) => c.total > 0 || c.solved > 0);

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

    const { currentStreak, maxStreak } = computeStreaksFromDailyActivity(
      agg?.dailyActivity || [],
    );

    const settings =
      resolved.settings ||
      (await PublicProfileSettings.findOne({ userId: user._id }).lean());

    const publicUsername = settings?.publicUsername || null;
    const usernameDerived =
      publicUsername ||
      String(user.email || "").split("@")[0] ||
      String(user._id);

    const descriptor =
      currentStreak > 0 ? `On a ${currentStreak}-day streak` : "No streak yet";

    const platforms = await PlatformProfile.find({ userId: user._id }).lean();
    const platformStats = await PlatformStats.find({ userId: user._id }).lean();
    const statsMap = new Map(platformStats.map((s) => [s.platform, s]));

    const platformsWithStats = platforms.map((p) => ({
      ...p,
      stats: statsMap.get(p.platform) || null,
    }));

    // Calculate weekly submissions (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weeklySubmissions = await Submission.countDocuments({
      userId: user._id,
      isRun: false,
      createdAt: { $gte: weekAgo },
    });

    // Calculate difficulty totals for progress bars
    const [difficultyTotals] = await Question.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: "$difficulty",
          count: { $sum: 1 },
        },
      },
    ]).then((results) => {
      const totals = { Easy: 0, Medium: 0, Hard: 0 };
      results.forEach((r) => {
        if (r._id && totals.hasOwnProperty(r._id)) {
          totals[r._id] = r.count;
        }
      });
      return [totals];
    });

    // Calculate accuracy by time of day
    const timeAccuracyAgg = await Submission.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(user._id),
          isRun: false,
        },
      },
      {
        $addFields: {
          hour: { $hour: "$createdAt" },
        },
      },
      {
        $addFields: {
          timeSlot: {
            $switch: {
              branches: [
                { case: { $and: [{ $gte: ["$hour", 6] }, { $lt: ["$hour", 12] }] }, then: "morning" },
                { case: { $and: [{ $gte: ["$hour", 12] }, { $lt: ["$hour", 18] }] }, then: "afternoon" },
                { case: { $and: [{ $gte: ["$hour", 18] }, { $lt: ["$hour", 24] }] }, then: "evening" },
              ],
              default: "night",
            },
          },
        },
      },
      {
        $group: {
          _id: "$timeSlot",
          total: { $sum: 1 },
          accepted: { $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] } },
        },
      },
    ]);

    const accuracyByTime = {};
    let bestTimeSlot = null;
    let bestAccuracy = 0;

    timeAccuracyAgg.forEach((slot) => {
      const accuracy = slot.total > 0 ? (slot.accepted / slot.total) * 100 : 0;
      accuracyByTime[slot._id] = {
        accuracy,
        attempts: slot.total,
        isBest: false,
      };
      if (accuracy > bestAccuracy && slot.total >= 3) {
        bestAccuracy = accuracy;
        bestTimeSlot = slot._id;
      }
    });

    if (bestTimeSlot && accuracyByTime[bestTimeSlot]) {
      accuracyByTime[bestTimeSlot].isBest = true;
    }

    return res.json({
      success: true,
      data: {
        user: {
          _id: String(user._id), // Include user ID for MIM components
          name: user.name,
          username: usernameDerived,
          profileImage: user.profileImage,
          descriptor,
          memberSince: user.createdAt
            ? String(new Date(user.createdAt).getFullYear())
            : "-",
          stats: user.stats || {},
          aiProfile: user.aiProfile || {},
          learningRoadmap: user.learningRoadmap || null,
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
          // New fields for widgets
          weeklySubmissions,
          easySolved: easyCount,
          easyTotal: difficultyTotals.Easy || 100,
          mediumSolved: mediumCount,
          mediumTotal: difficultyTotals.Medium || 200,
          hardSolved: hardCount,
          hardTotal: difficultyTotals.Hard || 100,
          accuracyByTime,
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
    return res
      .status(500)
      .json({ success: false, message: err.message || "Failed" });
  }
}
