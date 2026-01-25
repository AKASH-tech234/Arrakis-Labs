import axios from "axios";
import PlatformProfile from "../models/PlatformProfile.js";
import PlatformStats from "../models/PlatformStats.js";

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

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

async function fetchLeetCode(handle) {
  const query = `
    query userProfile($username: String!) {
      matchedUser(username: $username) {
        submitStats {
          acSubmissionNum { difficulty count submissions }
          totalSubmissionNum { difficulty count submissions }
        }
        contestBadge { name }
        userCalendar { submissionCalendar }
      }
      userContestRanking(username: $username) {
        rating
        topPercentage
      }
      userContestRankingHistory(username: $username) {
        rating
      }
    }
  `;

  const res = await axios.post(
    "https://leetcode.com/graphql",
    { query, variables: { username: handle } },
    { headers: { "Content-Type": "application/json" }, timeout: 15000 }
  );

  const matched = res?.data?.data?.matchedUser;
  if (!matched) throw new Error("LeetCode user not found");

  const ac = matched.submitStats?.acSubmissionNum || [];
  const total = matched.submitStats?.totalSubmissionNum || [];

  const getCount = (arr, diff) =>
    (arr.find((x) => x.difficulty === diff)?.count ?? 0);

  const totalSolved = ac.reduce((s, x) => s + (x.count || 0), 0);
  const totalAttempted = total.reduce((s, x) => s + (x.count || 0), 0);

  const difficulty = emptyDifficulty();
  difficulty.easy.solved = getCount(ac, "Easy");
  difficulty.medium.solved = getCount(ac, "Medium");
  difficulty.hard.solved = getCount(ac, "Hard");

  difficulty.easy.attempted = getCount(total, "Easy");
  difficulty.medium.attempted = getCount(total, "Medium");
  difficulty.hard.attempted = getCount(total, "Hard");

  const calendar = matched.userCalendar?.submissionCalendar;
  const daily = [];
  if (calendar) {
    try {
      const parsed = JSON.parse(calendar);
      for (const [unix, solved] of Object.entries(parsed)) {
        const dt = new Date(Number(unix) * 1000);
        daily.push({ date: isoDate(dt), solved: Number(solved) || 0 });
      }
    } catch {
      // ignore
    }
  }

  const now = new Date();
  const since30 = new Date(now);
  since30.setDate(now.getDate() - 30);
  const last30DaysSolved = daily
    .filter((d) => new Date(`${d.date}T00:00:00Z`) >= since30)
    .reduce((s, d) => s + (d.solved || 0), 0);

  const avgSolvedPerDay = Number((last30DaysSolved / 30).toFixed(3));

  const currentRating = res?.data?.data?.userContestRanking?.rating ?? null;
  const hist = res?.data?.data?.userContestRankingHistory || [];
  const highestRating = hist.length
    ? Math.max(...hist.map((h) => h.rating || 0), 0) || null
    : null;

  return {
    totalSolved,
    totalAttempted,
    last30DaysSolved,
    avgSolvedPerDay,
    contestsParticipated: hist.length,
    currentRating,
    highestRating,
    difficulty,
    skills: {},
    daily: daily.slice(-370),
    dataSource: "api",
  };
}

async function fetchCodeforces(handle) {
  const userInfo = await axios.get(
    `https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle)}`,
    { timeout: 15000 }
  );
  const info = userInfo?.data?.result?.[0];
  if (!info) throw new Error("Codeforces user not found");

  const rating = info.rating ?? null;
  const maxRating = info.maxRating ?? null;

  // lightweight submission history (recent only) to compute last 30 days accepted
  const statusRes = await axios.get(
    `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=1&count=2000`,
    { timeout: 15000 }
  );
  const subs = statusRes?.data?.result || [];

  const attempted = subs.length;
  const acceptedSubs = subs.filter((s) => s.verdict === "OK");

  const solvedSet = new Set();
  for (const s of acceptedSubs) {
    const key = `${s.problem?.contestId || ""}-${s.problem?.index || ""}`;
    if (key !== "-") solvedSet.add(key);
  }

  const now = new Date();
  const since30 = new Date(now);
  since30.setDate(now.getDate() - 30);

  const last30DaysSolved = acceptedSubs
    .filter((s) => new Date((s.creationTimeSeconds || 0) * 1000) >= since30)
    .reduce((count, s) => {
      const key = `${s.problem?.contestId || ""}-${s.problem?.index || ""}`;
      return count + (key !== "-" ? 1 : 0);
    }, 0);

  const avgSolvedPerDay = Number((last30DaysSolved / 30).toFixed(3));

  const difficulty = emptyDifficulty();

  // map CF rating to difficulty buckets (approx)
  for (const s of acceptedSubs) {
    const r = s.problem?.rating;
    if (!r) continue;
    if (r <= 1200) difficulty.easy.solved += 1;
    else if (r <= 1700) difficulty.medium.solved += 1;
    else difficulty.hard.solved += 1;
  }

  return {
    totalSolved: solvedSet.size,
    totalAttempted: attempted,
    last30DaysSolved,
    avgSolvedPerDay,
    contestsParticipated: info.friendOfCount || 0,
    currentRating: rating,
    highestRating: maxRating,
    difficulty,
    skills: {},
    daily: [],
    dataSource: "api",
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
    let fetchedData = null;

    // Fetch real data from external platforms
    if (profile.platform === "leetcode") {
      fetchedData = await fetchLeetCode(profile.handle);
    } else if (profile.platform === "codeforces") {
      fetchedData = await fetchCodeforces(profile.handle);
    }

    // If we have fetched data, update PlatformStats
    if (fetchedData) {
      const updateData = {
        totalSolved: fetchedData.totalSolved || 0,
        totalAttempted: fetchedData.totalAttempted || 0,
        last30DaysSolved: fetchedData.last30DaysSolved || 0,
        avgSolvedPerDay: fetchedData.avgSolvedPerDay || 0,
        contestsParticipated: fetchedData.contestsParticipated || 0,
        currentRating: fetchedData.currentRating,
        highestRating: fetchedData.highestRating,
        difficulty: fetchedData.difficulty || {
          easy: { solved: 0, attempted: 0 },
          medium: { solved: 0, attempted: 0 },
          hard: { solved: 0, attempted: 0 },
        },
        skills: fetchedData.skills || new Map(),
        daily: fetchedData.daily || [],
        dataSource: fetchedData.dataSource || "api",
        lastSyncedAt: new Date(),
      };

      await PlatformStats.findOneAndUpdate(
        { userId: profile.userId, platform: profile.platform },
        { $set: updateData },
        { upsert: true, new: true }
      );

      profile.syncStatus = "success";
      profile.lastSyncAt = new Date();
      profile.lastSyncError = null;
      await profile.save();

      return {
        skipped: false,
        platform: profile.platform,
        reason: "fetched",
        stats: updateData,
      };
    }

    // For unsupported platforms, create empty record if not exists
    let existing = await PlatformStats.findOne({
      userId: profile.userId,
      platform: profile.platform,
    });

    if (!existing) {
      existing = await PlatformStats.create({
        userId: profile.userId,
        platform: profile.platform,
        totalSolved: 0,
        totalAttempted: 0,
        last30DaysSolved: 0,
        avgSolvedPerDay: 0,
        contestsParticipated: 0,
        currentRating: null,
        highestRating: null,
        difficulty: {
          easy: { solved: 0, attempted: 0 },
          medium: { solved: 0, attempted: 0 },
          hard: { solved: 0, attempted: 0 },
        },
        skills: new Map(),
        daily: [],
        dataSource: "internal",
        lastSyncedAt: new Date(),
      });
    }

    profile.syncStatus = "success";
    profile.lastSyncAt = new Date();
    profile.lastSyncError = null;
    await profile.save();

    return {
      skipped: false,
      platform: profile.platform,
      reason: "unsupported_platform",
      stats: existing.toObject ? existing.toObject() : existing,
    };
  } catch (err) {
    profile.syncStatus = "error";
    profile.lastSyncError = err?.message || "Sync failed";
    profile.lastSyncAt = new Date();
    await profile.save();

    throw err;
  }
}
