import axios from "axios";
import * as cheerio from "cheerio";
import PlatformProfile from "../../models/profile/PlatformProfile.js";
import PlatformStats from "../../models/profile/PlatformStats.js";

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

function buildEmptyExternalStats({ dataSource = "scrape" } = {}) {
  return {
    totalSolved: 0,
    totalAttempted: 0,
    last30DaysSolved: 0,
    avgSolvedPerDay: 0,
    contestsParticipated: 0,
    currentRating: null,
    highestRating: null,
    difficulty: emptyDifficulty(),
    skills: {},
    daily: [],
    dataSource,
  };
}

function parseFirstInt(s) {
  const m = String(s || "").match(/(\d[\d,]*)/);
  if (!m) return null;
  return Number(String(m[1]).replace(/,/g, "")) || null;
}

function normalizeWhitespace(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
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

  for (const s of acceptedSubs) {
    const r = s.problem?.rating;
    if (!r) continue;
    if (r <= 1200) difficulty.easy.solved += 1;
    else if (r <= 1700) difficulty.medium.solved += 1;
    else difficulty.hard.solved += 1;
  }

  const dailyMap = new Map();
  for (const s of acceptedSubs) {
    if (!s.creationTimeSeconds) continue;
    const dt = new Date(s.creationTimeSeconds * 1000);
    const dateStr = isoDate(dt);
    dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + 1);
  }
  const daily = Array.from(dailyMap.entries())
    .map(([date, solved]) => ({ date, solved }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-370);

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
    daily,
    dataSource: "api",
  };
}

async function fetchCodeChef(handle) {
  const url = `https://www.codechef.com/users/${encodeURIComponent(handle)}`;

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  };

  console.info(`Fetching CodeChef stats for handle: ${handle}`);
  console.info("[codechef] request", { url });

  let res;
  try {
    res = await axios.get(url, {
      headers,
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: () => true,
    });
  } catch (err) {
    console.error("[codechef] request_failed", {
      url,
      message: err?.message,
    });
    return { ...buildEmptyExternalStats({ dataSource: "scrape" }), error: "FETCH_FAILED" };
  }

  const rawHtml = typeof res?.data === "string" ? res.data : "";

  console.info("[codechef] response", {
    url,
    status: res?.status,
    headers: res?.headers,
    rawBodyLength: rawHtml.length,
  });

  if (!rawHtml || res?.status >= 400) {
    const errorCode = res?.status === 404 ? "NOT_FOUND" : "FETCH_FAILED";
    console.error("[codechef] bad_status_or_empty_body", {
      url,
      status: res?.status,
      rawBodyLength: rawHtml.length,
    });
    return { ...buildEmptyExternalStats({ dataSource: "scrape" }), error: errorCode };
  }

  // Note: normal CodeChef pages often include the word "cloudflare" (e.g. via scripts),
  // so treating any occurrence as a block causes false positives.
  const blockedSignals = /(access denied|request blocked|captcha)/i;
  // Be careful: CodeChef pages are served via Cloudflare and often contain benign Cloudflare strings
  // like "/cdn-cgi/speculation" or "data-cf-modified". Those are not block pages.
  const cloudflareChallengeSignals =
    /(attention required\s*!?\s*\|\s*cloudflare|checking your browser|cf-chl-|challenge-platform\/|cf-turnstile|g-recaptcha)/i;

  const isLikelyBlocked =
    blockedSignals.test(rawHtml) ||
    cloudflareChallengeSignals.test(rawHtml) ||
    ((res?.status === 403 || res?.status === 429) && /cloudflare/i.test(rawHtml));

  if (isLikelyBlocked) {
    console.error("[codechef] blocked_detected", {
      url,
      status: res?.status,
      rawBodyLength: rawHtml.length,
    });
    return { ...buildEmptyExternalStats({ dataSource: "scrape" }), error: "FETCH_BLOCKED" };
  }

  try {
    const $ = cheerio.load(rawHtml);

    const ratingCandidates = [
      $(".rating-number").first().text(),
      $(".rating").first().text(),
      $("[class*=rating]").filter((_, el) => normalizeWhitespace($(el).text()) === "Rating").next().text(),
    ];

    let currentRating = null;
    for (const c of ratingCandidates) {
      const n = parseFirstInt(c);
      if (Number.isFinite(n)) {
        currentRating = n;
        break;
      }
    }

    if (currentRating === null) {
      const text = normalizeWhitespace($("body").text());
      const m = text.match(/\bRating\b\s*[:\-]?\s*(\d{3,5})/i);
      if (m) currentRating = Number(m[1]) || null;
    }

    const fullySolvedRegexes = [
      /Total\s*Problems\s*Solved\s*[:\-]?\s*(\d[\d,]*)/i,
      /Fully\s*Solved\s*\(\s*(\d[\d,]*)\s*\)/i,
      /Fully\s*Solved\s*[:\-]?\s*(\d[\d,]*)/i,
      /Problems\s*Solved\s*[:\-]?\s*(\d[\d,]*)/i,
      /\"fully_solved\"\s*:\s*(\d+)/i,
      /fully_solved\s*=\s*(\d+)/i,
    ];

    const bodyText = normalizeWhitespace($("body").text());
    let totalSolved = null;
    for (const re of fullySolvedRegexes) {
      const m = bodyText.match(re) || rawHtml.match(re);
      if (m?.[1]) {
        totalSolved = Number(String(m[1]).replace(/,/g, "")) || null;
        if (totalSolved !== null) break;
      }
    }

    if (totalSolved === null) {
      const possible = $("*:contains('Fully Solved')")
        .first()
        .parent()
        .text();
      totalSolved = parseFirstInt(possible);
    }

    if (!Number.isFinite(totalSolved)) {
      console.error("[codechef] parse_failed", {
        url,
        parsed: { totalSolved, currentRating },
      });
      return { ...buildEmptyExternalStats({ dataSource: "scrape" }), error: "PARSE_FAILED" };
    }

    return {
      ...buildEmptyExternalStats({ dataSource: "scrape" }),
      totalSolved: totalSolved || 0,
      currentRating,
      highestRating: null,
    };
  } catch (err) {
    console.error("[codechef] parse_exception", {
      url,
      message: err?.message,
    });
    return { ...buildEmptyExternalStats({ dataSource: "scrape" }), error: "PARSE_FAILED" };
  }
}

async function fetchAtCoder(handle) {
  const apiUrl = `https://kenkoooo.com/atcoder/atcoder-api/v3/user_info?user=${encodeURIComponent(handle)}`;
  const url = `https://atcoder.jp/users/${encodeURIComponent(handle)}`;
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  };

  console.info(`Fetching AtCoder stats for handle: ${handle}`);
  console.info("[atcoder] request", { apiUrl, url });

  let acceptedCount = null;

  try {
    const apiRes = await axios.get(apiUrl, {
      headers: { ...headers, Accept: "application/json,*/*;q=0.8" },
      timeout: 15000,
      validateStatus: () => true,
    });

    const bodyString =
      typeof apiRes?.data === "string" ? apiRes.data : JSON.stringify(apiRes?.data || {});
    console.info("[atcoder] response", {
      url: apiUrl,
      status: apiRes?.status,
      headers: apiRes?.headers,
      rawBodyLength: bodyString.length,
    });

    if (apiRes?.status === 200) {
      const v = apiRes?.data?.accepted_count;
      acceptedCount = Number.isFinite(v) ? v : Number(v);
      if (!Number.isFinite(acceptedCount)) acceptedCount = null;
    } else if (apiRes?.status === 404) {
      return { ...buildEmptyExternalStats({ dataSource: "api" }), error: "NOT_FOUND" };
    }
  } catch (err) {
    console.error("[atcoder] api_request_failed", { apiUrl, message: err?.message });
  }

  let res;
  try {
    res = await axios.get(url, {
      headers,
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: () => true,
    });
  } catch (err) {
    console.error("[atcoder] request_failed", { url, message: err?.message });
    return {
      ...buildEmptyExternalStats({ dataSource: acceptedCount !== null ? "api" : "scrape" }),
      totalSolved: acceptedCount || 0,
      error: acceptedCount !== null ? null : "FETCH_FAILED",
    };
  }

  const rawHtml = typeof res?.data === "string" ? res.data : "";
  console.info("[atcoder] response", {
    url,
    status: res?.status,
    headers: res?.headers,
    rawBodyLength: rawHtml.length,
  });

  if (!rawHtml || res?.status >= 400) {
    const errorCode = res?.status === 404 ? "NOT_FOUND" : "FETCH_FAILED";
    console.error("[atcoder] bad_status_or_empty_body", {
      url,
      status: res?.status,
      rawBodyLength: rawHtml.length,
    });
    return {
      ...buildEmptyExternalStats({ dataSource: acceptedCount !== null ? "api" : "scrape" }),
      totalSolved: acceptedCount || 0,
      error: acceptedCount !== null ? null : errorCode,
    };
  }

  try {
    const $ = cheerio.load(rawHtml);

    const getProfileValue = (label) => {
      const th = $("th")
        .filter((_, el) => normalizeWhitespace($(el).text()).toLowerCase() === label.toLowerCase())
        .first();
      if (!th.length) return null;
      const td = th.next("td");
      return td.length ? normalizeWhitespace(td.text()) : null;
    };

    const ratingText = getProfileValue("Rating") || null;
    const currentRating = parseFirstInt(ratingText);

    if (acceptedCount === null) {
      console.error("[atcoder] missing_accepted_count", { apiUrl });
      return {
        ...buildEmptyExternalStats({ dataSource: "scrape" }),
        totalSolved: 0,
        currentRating: Number.isFinite(currentRating) ? currentRating : null,
        error: "FETCH_FAILED",
      };
    }

    return {
      ...buildEmptyExternalStats({ dataSource: "api" }),
      totalSolved: acceptedCount || 0,
      currentRating: Number.isFinite(currentRating) ? currentRating : null,
      highestRating: null,
    };
  } catch (err) {
    console.error("[atcoder] parse_exception", { url, message: err?.message });
    return {
      ...buildEmptyExternalStats({ dataSource: acceptedCount !== null ? "api" : "scrape" }),
      totalSolved: acceptedCount || 0,
      error: acceptedCount !== null ? null : "PARSE_FAILED",
    };
  }
}

async function fetchHackerRank(handle) {
  const apiUrl = `https://www.hackerrank.com/rest/contests/master/hackers/${encodeURIComponent(handle)}/profile`;
  const htmlUrl = `https://www.hackerrank.com/${encodeURIComponent(handle)}`;

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    Accept: "application/json,text/html;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  };

  console.info(`Fetching HackerRank stats for handle: ${handle}`);
  console.info("[hackerrank] request", { apiUrl, htmlUrl });

  try {
    const res = await axios.get(apiUrl, {
      headers,
      timeout: 15000,
      validateStatus: () => true,
    });

    const bodyString =
      typeof res?.data === "string" ? res.data : JSON.stringify(res?.data || {});
    console.info("[hackerrank] response", {
      url: apiUrl,
      status: res?.status,
      headers: res?.headers,
      rawBodyLength: bodyString.length,
    });

    if (res?.status === 200 && res?.data) {
      const model = res.data?.model || res.data;
      const totalSolved =
        Number(model?.total_solved) ||
        Number(model?.solved_challenges) ||
        Number(model?.totalChallengesSolved) ||
        null;

      if (Number.isFinite(totalSolved)) {
        return {
          ...buildEmptyExternalStats({ dataSource: "api" }),
          totalSolved,
          currentRating: null,
          highestRating: null,
        };
      }

      console.error("[hackerrank] parse_failed", {
        url: apiUrl,
        keys: Object.keys(model || {}),
      });

      return { ...buildEmptyExternalStats({ dataSource: "api" }), error: "PARSE_FAILED" };
    }

    if (res?.status === 404) {
      return { ...buildEmptyExternalStats({ dataSource: "api" }), error: "NOT_FOUND" };
    }
  } catch (err) {
    console.error("[hackerrank] api_request_failed", { apiUrl, message: err?.message });
  }

  try {
    const res = await axios.get(htmlUrl, {
      headers,
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: () => true,
    });

    const rawHtml = typeof res?.data === "string" ? res.data : "";
    console.info("[hackerrank] response", {
      url: htmlUrl,
      status: res?.status,
      headers: res?.headers,
      rawBodyLength: rawHtml.length,
    });

    if (!rawHtml || res?.status >= 400) {
      const errorCode = res?.status === 404 ? "NOT_FOUND" : "FETCH_FAILED";
      return { ...buildEmptyExternalStats({ dataSource: "scrape" }), error: errorCode };
    }

    const m = rawHtml.match(/\b(total_solved|solved_challenges)\b\D{0,20}(\d{1,7})/i);
    const totalSolved = m?.[2] ? Number(m[2]) || null : null;
    if (!Number.isFinite(totalSolved)) {
      console.error("[hackerrank] parse_failed", { url: htmlUrl });
      return { ...buildEmptyExternalStats({ dataSource: "scrape" }), error: "PARSE_FAILED" };
    }

    return {
      ...buildEmptyExternalStats({ dataSource: "scrape" }),
      totalSolved,
      currentRating: null,
      highestRating: null,
    };
  } catch (err) {
    console.error("[hackerrank] request_failed", { htmlUrl, message: err?.message });
    return { ...buildEmptyExternalStats({ dataSource: "scrape" }), error: "FETCH_FAILED" };
  }
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

    if (profile.platform === "leetcode") {
      fetchedData = await fetchLeetCode(profile.handle);
    } else if (profile.platform === "codeforces") {
      fetchedData = await fetchCodeforces(profile.handle);
    } else if (profile.platform === "codechef") {
      fetchedData = await fetchCodeChef(profile.handle);
    } else if (profile.platform === "atcoder") {
      fetchedData = await fetchAtCoder(profile.handle);
    } else if (profile.platform === "hackerrank") {
      fetchedData = await fetchHackerRank(profile.handle);
    }

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

      const hadError = Boolean(fetchedData?.error);
      profile.syncStatus = hadError ? "error" : "success";
      profile.lastSyncAt = new Date();
      profile.lastSyncError = hadError ? String(fetchedData.error) : null;
      await profile.save();

      return {
        skipped: false,
        platform: profile.platform,
        reason: hadError ? "fetch_failed" : "fetched",
        error: hadError ? String(fetchedData.error) : null,
        stats: updateData,
      };
    }

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

    if (["codechef", "atcoder", "hackerrank"].includes(profile.platform)) {
      const updateData = {
        ...buildEmptyExternalStats({ dataSource: "scrape" }),
        lastSyncedAt: new Date(),
      };

      await PlatformStats.findOneAndUpdate(
        { userId: profile.userId, platform: profile.platform },
        { $set: updateData },
        { upsert: true, new: true }
      );

      return {
        skipped: false,
        platform: profile.platform,
        reason: "fetch_failed",
        error: "FETCH_FAILED",
        stats: updateData,
      };
    }

    throw err;
  }
}
