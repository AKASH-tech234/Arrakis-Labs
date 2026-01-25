import Contest from "../../models/contest/Contest.js";
import ContestRegistration from "../../models/contest/ContestRegistration.js";
import ContestSubmission from "../../models/contest/ContestSubmission.js";
import Question from "../../models/question/Question.js";
import TestCase from "../../models/question/TestCase.js";
import leaderboardService from "../../services/contest/leaderboardService.js";
import wsServer from "../../services/contest/websocketServer.js";
import mongoose from "mongoose";

function getContestLookup(contestId) {
  return mongoose.Types.ObjectId.isValid(contestId)
    ? { _id: contestId }
    : { slug: contestId };
}

/**
 * Contest Controller
 * Handles public contest operations (list, view, register, join)
 */

// ==========================================
// PUBLIC ENDPOINTS (Some require auth)
// ==========================================

/**
 * Get all public contests
 * GET /api/contests
 */
export const getContests = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const now = new Date();

    // Build query
    const query = { isActive: true, isPublic: true };

    if (status) {
      if (status === "upcoming") {
        query.status = "scheduled";
        query.startTime = { $gt: now };
      } else if (status === "live") {
        query.$or = [
          { status: "live" },
          { status: "scheduled", startTime: { $lte: now }, endTime: { $gt: now } },
        ];
      } else if (status === "past") {
        query.$or = [
          { status: "ended" },
          { endTime: { $lte: now } },
        ];
      } else {
        query.status = status;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [contests, total] = await Promise.all([
      Contest.find(query)
        .sort({ startTime: status === "past" ? -1 : 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select("name slug description startTime duration endTime status stats requiresRegistration")
        .lean(),
      Contest.countDocuments(query),
    ]);

    // Add computed fields
    let enrichedContests = contests.map((contest) => ({
      ...contest,
      isUpcoming: contest.startTime > now,
      isLive: now >= contest.startTime && now < contest.endTime,
      hasEnded: now >= contest.endTime,
      timeUntilStart: Math.max(0, Math.floor((new Date(contest.startTime) - now) / 1000)),
      remainingTime: Math.max(0, Math.floor((new Date(contest.endTime) - now) / 1000)),
      registration: null,
    }));

    // User-specific registration data (optional auth)
    if (req.user?._id && contests.length > 0) {
      const contestIds = contests.map((c) => c._id);
      const regs = await ContestRegistration.find({
        user: req.user._id,
        contest: { $in: contestIds },
      })
        .select("contest status registeredAt joinedAt problemsSolved finalScore")
        .lean();

      const regByContestId = new Map(
        regs.map((r) => [r.contest.toString(), r])
      );

      enrichedContests = enrichedContests.map((contest) => {
        const reg = regByContestId.get(contest._id.toString());
        return {
          ...contest,
          registration: reg
            ? {
                status: reg.status,
                registeredAt: reg.registeredAt,
                joinedAt: reg.joinedAt,
                problemsSolved: reg.problemsSolved,
                finalScore: reg.finalScore,
              }
            : null,
        };
      });
    }

    res.status(200).json({
      success: true,
      data: enrichedContests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[Get Contests Error]:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch contests" });
  }
};

/**
 * Get single contest details
 * GET /api/contests/:contestId
 */
export const getContest = async (req, res) => {
  try {
    const { contestId } = req.params;
    const userId = req.user?._id;
    const now = new Date();

    // Find by ID or slug
    const query = mongoose.Types.ObjectId.isValid(contestId)
      ? { _id: contestId }
      : { slug: contestId };

    const contest = await Contest.findOne({ ...query, isActive: true })
      .populate("problems.problem", "title difficulty")
      .lean();

    if (!contest) {
      return res.status(404).json({ success: false, message: "Contest not found" });
    }

    // Check user registration
    let registration = null;
    if (userId) {
      registration = await ContestRegistration.findOne({
        contest: contest._id,
        user: userId,
      }).lean();
    }

    // Compute status
    const isUpcoming = now < contest.startTime;
    const isLive = now >= contest.startTime && now < contest.endTime;
    const hasEnded = now >= contest.endTime;

    // Problems: hide if contest hasn't started (unless registered and joined)
    let problems = [];
    if (!isUpcoming || (registration?.status === "participating")) {
      problems = contest.problems.map((p, idx) => ({
        id: p.problem._id,
        label: p.label,
        title: p.problem.title,
        difficulty: p.problem.difficulty,
        points: p.points,
        order: p.order,
      }));
    }

    // Get solve counts if live or ended
    let problemStats = {};
    if ((isLive || hasEnded) && problems.length > 0) {
      for (const p of problems) {
        problemStats[p.id] = await leaderboardService.getProblemSolveCount(
          contest._id.toString(),
          p.id.toString()
        );
      }
    }

    // Online count
    const onlineCount = wsServer.getOnlineCount(contest._id.toString());

    res.status(200).json({
      success: true,
      data: {
        id: contest._id,
        name: contest.name,
        slug: contest.slug,
        description: contest.description,
        startTime: contest.startTime,
        endTime: contest.endTime,
        duration: contest.duration,
        status: contest.status,
        rankingType: contest.rankingType,
        requiresRegistration: contest.requiresRegistration,
        allowLateJoin: contest.allowLateJoin,
        lateJoinDeadline: contest.lateJoinDeadline,
        showLeaderboardDuringContest: contest.showLeaderboardDuringContest,
        scoringRules: contest.scoringRules,
        penaltyRules: contest.penaltyRules,
        stats: contest.stats,
        // Computed
        isUpcoming,
        isLive,
        hasEnded,
        timeUntilStart: Math.max(0, Math.floor((contest.startTime - now) / 1000)),
        remainingTime: Math.max(0, Math.floor((contest.endTime - now) / 1000)),
        serverTime: now.toISOString(),
        onlineCount,
        // User-specific
        registration: registration
          ? {
              status: registration.status,
              registeredAt: registration.registeredAt,
              joinedAt: registration.joinedAt,
              problemsSolved: registration.problemsSolved,
              finalScore: registration.finalScore,
            }
          : null,
        // Problems (hidden before start)
        problems,
        problemStats,
        // Editorial (after contest)
        editorial: hasEnded && contest.editorialVisible ? contest.editorial : null,
      },
    });
  } catch (error) {
    console.error("[Get Contest Error]:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch contest" });
  }
};

/**
 * Register for a contest
 * POST /api/contests/:contestId/register
 */
export const registerForContest = async (req, res) => {
  try {
    const { contestId } = req.params;
    const userId = req.user._id;
    const now = new Date();

    const contest = await Contest.findOne({
      ...getContestLookup(contestId),
      isActive: true,
    });

    if (!contest) {
      return res.status(404).json({ success: false, message: "Contest not found" });
    }

    // Check registration window
    if (contest.registrationStart && now < contest.registrationStart) {
      return res.status(400).json({
        success: false,
        message: "Registration has not opened yet",
      });
    }

    if (contest.registrationEnd && now > contest.registrationEnd) {
      return res.status(400).json({
        success: false,
        message: "Registration has closed",
      });
    }

    // Check if already ended
    if (now >= contest.endTime) {
      return res.status(400).json({
        success: false,
        message: "Contest has already ended",
      });
    }

    // Check max participants
    if (contest.maxParticipants > 0) {
      const count = await ContestRegistration.countDocuments({
        contest: contest._id,
      });
      if (count >= contest.maxParticipants) {
        return res.status(400).json({
          success: false,
          message: "Contest is full",
        });
      }
    }

    // Check existing registration
    let registration = await ContestRegistration.findOne({
      contest: contest._id,
      user: userId,
    });

    if (registration) {
      return res.status(400).json({
        success: false,
        message: "You are already registered",
        data: { status: registration.status },
      });
    }

    // Create registration
    registration = await ContestRegistration.create({
      contest: contest._id,
      user: userId,
      registeredAt: now,
      status: "registered",
    });

    // Update contest stats
    await Contest.findByIdAndUpdate(contest._id, {
      $inc: { "stats.registeredCount": 1 },
    });

    res.status(201).json({
      success: true,
      message: "Successfully registered for contest",
      data: {
        registrationId: registration._id,
        status: registration.status,
        registeredAt: registration.registeredAt,
      },
    });
  } catch (error) {
    console.error("[Register Contest Error]:", error.message);
    res.status(500).json({ success: false, message: "Failed to register" });
  }
};

/**
 * Join a contest (start participating)
 * POST /api/contests/:contestId/join
 */
export const joinContest = async (req, res) => {
  try {
    const { contestId } = req.params;
    const userId = req.user._id;
    const now = new Date();

    const contest = await Contest.findOne({
      ...getContestLookup(contestId),
      isActive: true,
    });

    if (!contest) {
      return res.status(404).json({ success: false, message: "Contest not found" });
    }

    const registration = await ContestRegistration.findOne({
      contest: contest._id,
      user: userId,
    });

    // Check if contest has started
    if (now < contest.startTime) {
      return res.status(400).json({
        success: false,
        message: "Contest has not started yet",
        data: { startsIn: Math.floor((contest.startTime - now) / 1000) },
      });
    }

    // Check if contest has ended
    if (now >= contest.endTime) {
      return res.status(400).json({
        success: false,
        message: "Contest has ended",
      });
    }

    // Check late join
    if (!contest.allowLateJoin && now > contest.startTime) {
      return res.status(400).json({
        success: false,
        message: "Late joining is not allowed for this contest",
      });
    }

    const lateDeadline = new Date(
      contest.startTime.getTime() + contest.lateJoinDeadline * 60 * 1000
    );
    if (now > lateDeadline) {
      return res.status(400).json({
        success: false,
        message: "Late join deadline has passed",
      });
    }

    // Create registration if not exists (for contests without required registration)
    let reg = registration;
    if (!reg && !contest.requiresRegistration) {
      reg = await ContestRegistration.create({
        contest: contest._id,
        user: userId,
        registeredAt: now,
        status: "registered",
      });
      await Contest.findByIdAndUpdate(contest._id, {
        $inc: { "stats.registeredCount": 1 },
      });
    }

    if (!reg) {
      return res.status(400).json({
        success: false,
        message: "You must register for this contest first",
      });
    }

    if (reg.status === "disqualified") {
      return res.status(403).json({
        success: false,
        message: "You have been disqualified from this contest",
      });
    }

    // Mark as joined
    if (reg.status === "registered") {
      await reg.markJoined(contest.startTime);

      // Update participated count
      await Contest.findByIdAndUpdate(contest._id, {
        $inc: { "stats.participatedCount": 1 },
      });

      // Initialize in Redis
      await leaderboardService.updateScore(contest._id.toString(), userId.toString(), {
        problemsSolved: 0,
        totalTimeSeconds: 0,
        penaltyMinutes: 0,
      });
    }

    // Calculate remaining time for this user
    const effectiveStart = reg.effectiveStartTime || contest.startTime;
    const remainingTime = Math.max(0, Math.floor((contest.endTime - now) / 1000));

    // Get problems
    const problems = contest.problems.map((p) => ({
      id: p.problem,
      label: p.label,
      points: p.points,
    }));

    res.status(200).json({
      success: true,
      message: "Successfully joined contest",
      data: {
        status: reg.status,
        effectiveStartTime: reg.effectiveStartTime,
        remainingTime,
        endTime: contest.endTime,
        serverTime: now.toISOString(),
        problems,
      },
    });
  } catch (error) {
    console.error("[Join Contest Error]:", error.message);
    res.status(500).json({ success: false, message: "Failed to join contest" });
  }
};

/**
 * Get contest problem details
 * GET /api/contests/:contestId/problems/:problemId
 */
export const getContestProblem = async (req, res) => {
  try {
    const { contestId, problemId } = req.params;
    const userId = req.user?._id;
    const now = new Date();

    const contest = await Contest.findOne({
      ...getContestLookup(contestId),
      isActive: true,
    });

    if (!contest) {
      return res.status(404).json({ success: false, message: "Contest not found" });
    }

    const registration = userId
      ? await ContestRegistration.findOne({ contest: contest._id, user: userId })
      : null;

    // Check if contest has started or user is participating
    if (now < contest.startTime && registration?.status !== "participating") {
      return res.status(403).json({
        success: false,
        message: "Contest has not started yet",
      });
    }

    // Find problem in contest
    const contestProblem = contest.problems.find(
      (p) => p.problem.toString() === problemId
    );

    if (!contestProblem) {
      return res.status(404).json({
        success: false,
        message: "Problem not found in this contest",
      });
    }

    // Get problem details
    const problem = await Question.findById(problemId)
      .select("-createdBy -updatedBy -__v")
      .lean();

    if (!problem) {
      return res.status(404).json({ success: false, message: "Problem not found" });
    }

    // Get visible test cases
    const visibleTestCases = await TestCase.find({
      questionId: problemId,
      isActive: true,
      isHidden: false,
    })
      .sort({ order: 1 })
      .select("stdin expectedStdout label")
      .lean();

    // Get user's submissions for this problem
    let userSubmissions = [];
    if (userId && registration) {
      userSubmissions = await ContestSubmission.find({
        contest: contest._id,
        user: userId,
        problem: problemId,
      })
        .sort({ submittedAt: -1 })
        .limit(10)
        .select("verdict testsPassed testsTotal submittedAt timeFromStart language")
        .lean();
    }

    // Get attempt info from registration
    const attemptInfo = registration?.problemAttempts?.get(problemId) || {
      attempts: 0,
      solved: false,
    };

    res.status(200).json({
      success: true,
      data: {
        // Contest context
        contestId: contest._id,
        label: contestProblem.label,
        points: contestProblem.points,
        // Problem data
        id: problem._id,
        title: problem.title,
        description: problem.description,
        difficulty: problem.difficulty,
        constraints: problem.constraints,
        examples: problem.examples,
        tags: problem.tags,
        // Test cases (visible only)
        sampleTestCases: visibleTestCases.map((tc) => ({
          label: tc.label,
          input: tc.stdin,
          expectedOutput: tc.expectedStdout,
        })),
        // User progress
        attemptInfo,
        recentSubmissions: userSubmissions,
      },
    });
  } catch (error) {
    console.error("[Get Contest Problem Error]:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch problem" });
  }
};

/**
 * Get contest leaderboard
 * GET /api/contests/:contestId/leaderboard
 */
export const getLeaderboard = async (req, res) => {
  try {
    const { contestId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user?._id;

    const contest = await Contest.findOne({
      ...getContestLookup(contestId),
      isActive: true,
    }).lean();

    if (!contest) {
      return res.status(404).json({ success: false, message: "Contest not found" });
    }

    const now = new Date();
    const isLive = now >= contest.startTime && now < contest.endTime;

    // Check if leaderboard should be shown
    if (isLive && !contest.showLeaderboardDuringContest) {
      return res.status(403).json({
        success: false,
        message: "Leaderboard is hidden during the contest",
      });
    }

    // Check freeze
    const freezeTime = new Date(
      contest.endTime.getTime() - contest.freezeLeaderboardMinutes * 60 * 1000
    );
    const isFrozen = isLive && now >= freezeTime && contest.freezeLeaderboardMinutes > 0;

    // Get from Redis
    const leaderboardData = await leaderboardService.getLeaderboard(
      contest._id.toString(),
      parseInt(page),
      parseInt(limit)
    );

    // Enrich with user data
    const userIds = leaderboardData.entries.map((e) => e.userId);
    const users = await mongoose.model("User").find(
      { _id: { $in: userIds } },
      "name profileImage"
    ).lean();

    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const entries = leaderboardData.entries.map((entry) => {
      const user = userMap.get(entry.userId);
      return {
        rank: entry.rank,
        userId: entry.userId,
        username: user?.name || "Unknown",
        profileImage: user?.profileImage,
        problemsSolved: entry.problemsSolved,
        totalTime: entry.totalTimeSeconds,
        totalTimeFormatted: formatTime(entry.totalTimeSeconds),
      };
    });

    // Get user's own rank if authenticated
    let userRank = null;
    if (userId) {
      userRank = await leaderboardService.getUserRank(contest._id.toString(), userId.toString());
    }

    res.status(200).json({
      success: true,
      data: {
        entries,
        total: leaderboardData.total,
        page: leaderboardData.page,
        pageSize: leaderboardData.pageSize,
        isFrozen,
        frozenAt: isFrozen ? freezeTime : null,
        userRank,
      },
    });
  } catch (error) {
    console.error("[Get Leaderboard Error]:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch leaderboard" });
  }
};

/**
 * Get user's contest standing
 * GET /api/contests/:contestId/standing
 */
export const getUserStanding = async (req, res) => {
  try {
    const { contestId } = req.params;
    const userId = req.user._id;

    const contest = await Contest.findOne({
      ...getContestLookup(contestId),
      isActive: true,
    }).lean();

    if (!contest) {
      return res.status(404).json({ success: false, message: "Contest not found" });
    }

    const registration = await ContestRegistration.findOne({
      contest: contest._id,
      user: userId,
    }).lean();

    if (!contest) {
      return res.status(404).json({ success: false, message: "Contest not found" });
    }

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "You are not registered for this contest",
      });
    }

    // Get current rank from Redis
    const rank = await leaderboardService.getUserRank(contest._id.toString(), userId.toString());

    // Get surrounding users
    const context = await leaderboardService.getUserContext(contest._id.toString(), userId.toString(), 3);

    res.status(200).json({
      success: true,
      data: {
        rank,
        score: registration.finalScore,
        problemsSolved: registration.problemsSolved,
        totalTime: registration.totalTime,
        totalPenalty: registration.totalPenalty,
        problemAttempts: Object.fromEntries(registration.problemAttempts || []),
        surrounding: context?.entries || [],
      },
    });
  } catch (error) {
    console.error("[Get User Standing Error]:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch standing" });
  }
};

/**
 * Get user's analytics after contest
 * GET /api/contests/:contestId/analytics
 */
export const getContestAnalytics = async (req, res) => {
  try {
    const { contestId } = req.params;
    const userId = req.user._id;

    const contest = await Contest.findOne({
      ...getContestLookup(contestId),
      isActive: true,
    })
      .populate("problems.problem", "title difficulty")
      .lean();

    if (!contest) {
      return res.status(404).json({ success: false, message: "Contest not found" });
    }

    const registration = await ContestRegistration.findOne({
      contest: contest._id,
      user: userId,
    }).lean();

    if (!contest) {
      return res.status(404).json({ success: false, message: "Contest not found" });
    }

    const now = new Date();
    if (now < contest.endTime) {
      return res.status(403).json({
        success: false,
        message: "Analytics available after contest ends",
      });
    }

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "You did not participate in this contest",
      });
    }

    // Get all user's submissions
    const submissions = await ContestSubmission.find({
      contest: contest._id,
      user: userId,
    })
      .sort({ submittedAt: 1 })
      .select("problemLabel verdict testsPassed testsTotal submittedAt timeFromStart language code")
      .lean();

    // Build per-problem analytics
    const problemAnalytics = contest.problems.map((p) => {
      const problemId = p.problem._id.toString();
      const attempt = registration.problemAttempts?.get(problemId) || {};
      const problemSubmissions = submissions.filter(
        (s) => s.problemLabel === p.label
      );

      return {
        label: p.label,
        title: p.problem.title,
        difficulty: p.problem.difficulty,
        points: p.points,
        solved: attempt.solved || false,
        attempts: attempt.attempts || 0,
        solveTime: attempt.solveTime || null,
        solveTimeFormatted: attempt.solveTime ? formatTime(attempt.solveTime) : null,
        penalty: attempt.penalty || 0,
        submissions: problemSubmissions.map((s) => ({
          verdict: s.verdict,
          testsPassed: s.testsPassed,
          testsTotal: s.testsTotal,
          submittedAt: s.submittedAt,
          timeFromStart: s.timeFromStart,
          language: s.language,
        })),
      };
    });

    res.status(200).json({
      success: true,
      data: {
        contestName: contest.name,
        finalRank: registration.finalRank,
        finalScore: registration.finalScore,
        problemsSolved: registration.problemsSolved,
        totalTime: registration.totalTime,
        totalTimeFormatted: formatTime(registration.totalTime),
        totalPenalty: registration.totalPenalty,
        ratingChange: registration.ratingChange,
        problemAnalytics,
      },
    });
  } catch (error) {
    console.error("[Get Contest Analytics Error]:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch analytics" });
  }
};

// Helper function to format time
function formatTime(seconds) {
  if (!seconds) return "0:00";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default {
  getContests,
  getContest,
  registerForContest,
  joinContest,
  getContestProblem,
  getLeaderboard,
  getUserStanding,
  getContestAnalytics,
};
