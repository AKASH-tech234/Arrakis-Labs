import PlatformStats from "../../models/profile/PlatformStats.js";
import AggregatedStats from "../../models/profile/AggregatedStats.js";
import Submission from "../../models/profile/Submission.js";
import ContestRegistration from "../../models/contest/ContestRegistration.js";
import Question from "../../models/question/Question.js";

const SKILLS = [
  "Arrays",
  "Strings",
  "Recursion",
  "Linked List",
  "Stack & Queue",
  "Trees",
  "Graph",
  "Dynamic Programming",
  "Greedy",
  "Bit Manipulation",
  "Math",
  "Sliding Window",
];

function strengthLevel(solved) {
  if (solved >= 30) return "Strong";
  if (solved >= 10) return "Intermediate";
  return "Beginner";
}

function normalizeDifficulty(qDifficulty) {
  const d = (qDifficulty || "").toLowerCase();
  if (d === "easy") return "easy";
  if (d === "medium") return "medium";
  if (d === "hard") return "hard";
  return null;
}

function pickSkillFromTags(tags = []) {
  const normalized = tags.map((t) => String(t).toLowerCase());

  const matches = new Set();
  for (const tag of normalized) {
    if (tag.includes("array")) matches.add("Arrays");
    if (tag.includes("string")) matches.add("Strings");
    if (tag.includes("recursion")) matches.add("Recursion");
    if (tag.includes("linked") || tag.includes("linked list")) matches.add("Linked List");
    if (tag.includes("stack") || tag.includes("queue")) matches.add("Stack & Queue");
    if (tag.includes("tree")) matches.add("Trees");
    if (tag.includes("graph")) matches.add("Graph");
    if (tag.includes("dp") || tag.includes("dynamic")) matches.add("Dynamic Programming");
    if (tag.includes("greedy")) matches.add("Greedy");
    if (tag.includes("bit")) matches.add("Bit Manipulation");
    if (tag.includes("math")) matches.add("Math");
    if (tag.includes("sliding")) matches.add("Sliding Window");
  }

  return matches.size ? Array.from(matches) : [];
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function monthKey(d) {
  return d.toISOString().slice(0, 7);
}

function weekStartKey(d) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay();
  const diff = (day + 6) % 7; // Monday start
  date.setUTCDate(date.getUTCDate() - diff);
  return isoDate(date);
}

function startOfUtcDay(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function computeArrakisPlatformStats(userId) {
  const now = new Date();
  const since30 = new Date(now);
  since30.setDate(now.getDate() - 30);

  // Accepted (non-run) submissions
  const accepted = await Submission.find({
    userId,
    isRun: false,
    status: "accepted",
  })
    .select("questionId createdAt")
    .lean();

  const attempted = await Submission.find({ userId, isRun: false })
    .select("questionId createdAt")
    .lean();

  const uniqueSolvedIds = new Set(accepted.map((s) => String(s.questionId)));
  const totalSolved = uniqueSolvedIds.size;

  const totalAttempted = attempted.length;

  const last30SolvedUnique = new Set(
    accepted
      .filter((s) => new Date(s.createdAt) >= since30)
      .map((s) => String(s.questionId))
  );

  const dailyMap = new Map();
  for (const s of accepted) {
    const key = isoDate(new Date(s.createdAt));
    dailyMap.set(key, (dailyMap.get(key) || 0) + 1);
  }

  // Difficulty + skills (based on accepted unique problems)
  const questionIds = Array.from(uniqueSolvedIds);
  const questions = await Question.find({ _id: { $in: questionIds } })
    .select("difficulty tags")
    .lean();

  const difficulty = {
    easy: { solved: 0, attempted: 0 },
    medium: { solved: 0, attempted: 0 },
    hard: { solved: 0, attempted: 0 },
  };

  // Attempted difficulty (best-effort by attempted submissions)
  const attemptedQuestionIds = Array.from(new Set(attempted.map((s) => String(s.questionId))));
  const attemptedQuestions = await Question.find({ _id: { $in: attemptedQuestionIds } })
    .select("difficulty")
    .lean();

  for (const q of attemptedQuestions) {
    const d = normalizeDifficulty(q.difficulty);
    if (!d) continue;
    difficulty[d].attempted += 1;
  }

  const skills = new Map();
  for (const skill of SKILLS) {
    skills.set(skill, { solved: 0, attempted: 0, accuracy: 0, strengthLevel: "Beginner" });
  }

  for (const q of questions) {
    const d = normalizeDifficulty(q.difficulty);
    if (d) difficulty[d].solved += 1;

    const matched = pickSkillFromTags(q.tags || []);
    for (const s of matched) {
      const prev = skills.get(s) || { solved: 0, attempted: 0, accuracy: 0, strengthLevel: "Beginner" };
      prev.solved += 1;
      skills.set(s, prev);
    }
  }

  // Contests participated (registered)
  const contestsParticipated = await ContestRegistration.countDocuments({ user: userId });

  // avg solved/day over last 30 days
  const avgSolvedPerDay = Number((last30SolvedUnique.size / 30).toFixed(3));

  // finalize skill accuracy/strength (accuracy unknown for tag attempts; keep 0-100 based on solved/attempted)
  for (const [k, v] of skills.entries()) {
    const attemptedCount = v.attempted || v.solved;
    v.attempted = attemptedCount;
    v.accuracy = attemptedCount > 0 ? Number(((v.solved / attemptedCount) * 100).toFixed(1)) : 0;
    v.strengthLevel = strengthLevel(v.solved);
    skills.set(k, v);
  }

  const daily = Array.from(dailyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-370)
    .map(([date, solved]) => ({ date, solved }));

  return {
    platform: "arrakis",
    totalSolved,
    totalAttempted,
    last30DaysSolved: last30SolvedUnique.size,
    avgSolvedPerDay,
    contestsParticipated,
    difficulty,
    skills,
    daily,
    dataSource: "internal",
    lastSyncedAt: new Date(),
  };
}

export async function upsertArrakisStats(userId) {
  const stats = await computeArrakisPlatformStats(userId);

  await PlatformStats.findOneAndUpdate(
    { userId, platform: "arrakis" },
    {
      userId,
      ...stats,
      // convert Map to plain object for mongoose
      skills: Object.fromEntries(stats.skills),
    },
    { upsert: true, new: true }
  );
}

export async function computeAggregatedStats(userId) {
  await upsertArrakisStats(userId);

  const platformStats = await PlatformStats.find({ userId }).lean();

  const totalSolved = platformStats.reduce((s, p) => s + (p.totalSolved || 0), 0);
  const totalAttempted = platformStats.reduce((s, p) => s + (p.totalAttempted || 0), 0);
  const totalContests = platformStats.reduce((s, p) => s + (p.contestsParticipated || 0), 0);

  const bestPlatform = platformStats.reduce(
    (best, p) => ((p.totalSolved || 0) > (best.totalSolved || 0) ? p : best),
    { platform: null, totalSolved: -1 }
  ).platform;

  const difficulty = {
    easy: { solved: 0, attempted: 0 },
    medium: { solved: 0, attempted: 0 },
    hard: { solved: 0, attempted: 0 },
  };

  const skillAgg = new Map();

  for (const p of platformStats) {
    for (const key of Object.keys(difficulty)) {
      difficulty[key].solved += p.difficulty?.[key]?.solved || 0;
      difficulty[key].attempted += p.difficulty?.[key]?.attempted || 0;
    }

    if (p.skills) {
      for (const [skillName, v] of Object.entries(p.skills)) {
        const prev = skillAgg.get(skillName) || { solved: 0, accuracySum: 0, n: 0 };
        prev.solved += v.solved || 0;
        prev.accuracySum += v.accuracy || 0;
        prev.n += 1;
        skillAgg.set(skillName, prev);
      }
    }
  }

  const skills = new Map();
  for (const [skillName, v] of skillAgg.entries()) {
    const solved = v.solved;
    const accuracy = v.n > 0 ? Number((v.accuracySum / v.n).toFixed(1)) : 0;
    const level = strengthLevel(solved);
    const weak = solved > 0 ? solved < 5 : true;
    skills.set(skillName, { solved, accuracy, strengthLevel: level, weak });
  }

  // Daily activity from real submission timestamps (internal DB)
  const now = new Date();
  const since365 = startOfUtcDay(new Date(now));
  since365.setUTCDate(since365.getUTCDate() - 364);

  const recentSubs = await Submission.find({
    userId,
    isRun: false,
    createdAt: { $gte: since365 },
  })
    .select("createdAt")
    .lean();

  const activityMap = new Map();
  for (const s of recentSubs) {
    const key = isoDate(new Date(s.createdAt));
    activityMap.set(key, (activityMap.get(key) || 0) + 1);
  }

  const dailyActivity = [];
  for (let i = 0; i < 365; i++) {
    const d = new Date(since365);
    d.setUTCDate(since365.getUTCDate() + i);
    const key = isoDate(d);
    dailyActivity.push({ date: key, count: activityMap.get(key) || 0 });
  }

  const activeDays = dailyActivity.filter((d) => (d.count || 0) > 0).length;
  const consistencyScore = Math.round((activeDays / 365) * 100);

  const avgSolvedPerDay = Number((totalSolved / Math.max(365, 1)).toFixed(3));

  // very simple weighted rating: average of platforms that have rating
  const ratings = platformStats
    .map((p) => p.currentRating)
    .filter((r) => Number.isFinite(r));
  const weightedAvgRating = ratings.length
    ? Math.round(ratings.reduce((s, r) => s + r, 0) / ratings.length)
    : null;

  // weekly/monthly trends from daily activity
  const weeklyMap = new Map();
  const monthlyMap = new Map();
  for (const d of dailyActivity) {
    const dt = new Date(`${d.date}T00:00:00Z`);
    const wk = weekStartKey(dt);
    weeklyMap.set(wk, (weeklyMap.get(wk) || 0) + (d.count || 0));
    const mk = monthKey(dt);
    monthlyMap.set(mk, (monthlyMap.get(mk) || 0) + (d.count || 0));
  }

  const weeklyTrend = Array.from(weeklyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-30)
    .map(([weekStart, solved]) => ({ weekStart, solved }));

  const monthlyTrend = Array.from(monthlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-24)
    .map(([month, solved]) => ({ month, solved }));

  const doc = await AggregatedStats.findOneAndUpdate(
    { userId },
    {
      userId,
      totalSolved,
      totalAttempted,
      avgSolvedPerDay,
      totalContests,
      weightedAvgRating,
      bestPlatform,
      consistencyScore,
      difficulty,
      skills: Object.fromEntries(skills),
      weeklyTrend,
      monthlyTrend,
      dailyActivity,
      computedAt: new Date(),
    },
    { upsert: true, new: true }
  );

  return doc;
}
