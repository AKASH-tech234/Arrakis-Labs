import POTDCalendar from "../models/POTDCalendar.js";
import PublishedPOTD from "../models/PublishedPOTD.js";
import UserPOTDTracking from "../models/UserPOTDTracking.js";
import UserStreak from "../models/UserStreak.js";
import Question from "../models/Question.js";
import potdScheduler from "../services/potdScheduler.js";

/**
 * POTD Controller
 * Handles all POTD-related operations for users
 */

/**
 * Get today's Problem of the Day
 * @route GET /api/potd/today
 * @access Public
 */
export const getTodaysPOTD = async (req, res) => {
  try {
    const potd = await PublishedPOTD.getToday();

    if (!potd) {
      return res.status(404).json({
        success: false,
        message: "No Problem of the Day available for today",
        data: null,
      });
    }

    // Get user's tracking data if authenticated
    let userTracking = null;
    if (req.user) {
      userTracking = await UserPOTDTracking.findOne({
        userId: req.user._id,
        potdId: potd._id,
      });
    }

    // Calculate time remaining
    const now = new Date();
    const timeRemaining = Math.max(0, potd.endTime - now);

    res.json({
      success: true,
      data: {
        potd: {
          _id: potd._id,
          activeDate: potd.activeDate,
          problem: potd.problemId,
          startTime: potd.startTime,
          endTime: potd.endTime,
          stats: potd.stats,
        },
        userProgress: userTracking
          ? {
              solved: userTracking.solved,
              attempts: userTracking.attempts,
              solvedAt: userTracking.solvedAt,
            }
          : null,
        timeRemaining: timeRemaining,
        timeRemainingFormatted: formatTimeRemaining(timeRemaining),
      },
    });
  } catch (error) {
    console.error("Error fetching today's POTD:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch Problem of the Day",
      error: error.message,
    });
  }
};

/**
 * Get user's POTD streak information
 * @route GET /api/potd/streak
 * @access Private
 */
export const getUserStreak = async (req, res) => {
  try {
    const streakInfo = await UserStreak.checkAndUpdateStreak(req.user._id);

    res.json({
      success: true,
      data: {
        currentStreak: streakInfo.currentStreak,
        maxStreak: streakInfo.maxStreak,
        lastSolvedDate: streakInfo.lastSolvedDate,
        totalPOTDsSolved: streakInfo.totalPOTDsSolved,
        streakStartDate: streakInfo.streakStartDate,
      },
    });
  } catch (error) {
    console.error("Error fetching user streak:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch streak information",
      error: error.message,
    });
  }
};

/**
 * Get user's POTD calendar (solved/missed history)
 * @route GET /api/potd/calendar
 * @access Private
 */
export const getUserPOTDCalendar = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Default to current month if not specified
    const start = startDate
      ? new Date(startDate)
      : new Date(new Date().setDate(1));
    const end = endDate ? new Date(endDate) : new Date();

    // Get user's POTD tracking records
    const userTracking = await UserPOTDTracking.getUserCalendar(
      req.user._id,
      start,
      end
    );

    // Get all published POTDs in the date range
    const publishedPOTDs = await PublishedPOTD.find({
      activeDate: { $gte: start, $lte: end },
    }).sort({ activeDate: -1 });

    // Build calendar data
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const calendarData = publishedPOTDs.map((potd) => {
      const potdDate = new Date(potd.activeDate);
      potdDate.setUTCHours(0, 0, 0, 0);

      const tracking = userTracking.find(
        (t) => t.potdId.toString() === potd._id.toString()
      );

      const isToday = potdDate.getTime() === today.getTime();
      const isPast = potdDate < today;

      let status;
      if (isToday) {
        status = tracking?.solved ? "solved" : "active";
      } else if (isPast) {
        status = tracking?.solved ? "solved" : "missed";
      } else {
        status = "upcoming";
      }

      return {
        date: potd.activeDate,
        problemId: potd.problemId,
        status,
        solved: tracking?.solved || false,
        attempts: tracking?.attempts || 0,
        solvedAt: tracking?.solvedAt,
      };
    });

    res.json({
      success: true,
      data: {
        calendar: calendarData,
        summary: {
          totalDays: publishedPOTDs.length,
          solvedDays: calendarData.filter((d) => d.solved).length,
          missedDays: calendarData.filter((d) => d.status === "missed").length,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching POTD calendar:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch POTD calendar",
      error: error.message,
    });
  }
};

/**
 * Record user's POTD attempt
 * @route POST /api/potd/attempt
 * @access Private
 */
export const recordPOTDAttempt = async (req, res) => {
  try {
    const potd = await PublishedPOTD.getToday();

    if (!potd) {
      return res.status(404).json({
        success: false,
        message: "No POTD available for today",
      });
    }

    // Check if POTD is still active
    const now = new Date();
    if (now < potd.startTime || now > potd.endTime) {
      return res.status(400).json({
        success: false,
        message: "POTD is no longer active",
      });
    }

    // Get or create tracking entry
    let tracking = await UserPOTDTracking.getOrCreate(
      req.user._id,
      potd._id,
      potd.problemId,
      potd.activeDate
    );

    // Update attempt count
    if (!tracking.firstAttemptAt) {
      tracking.firstAttemptAt = now;
    }
    tracking.lastAttemptAt = now;
    tracking.attempts += 1;
    await tracking.save();

    // Update POTD stats
    await PublishedPOTD.findByIdAndUpdate(potd._id, {
      $inc: { "stats.totalAttempts": 1 },
    });

    // Record attempt in streak
    await UserStreak.recordAttempt(req.user._id);

    res.json({
      success: true,
      data: {
        attempts: tracking.attempts,
        message: "Attempt recorded",
      },
    });
  } catch (error) {
    console.error("Error recording POTD attempt:", error);
    res.status(500).json({
      success: false,
      message: "Failed to record attempt",
      error: error.message,
    });
  }
};

/**
 * Mark POTD as solved
 * @route POST /api/potd/solve
 * @access Private
 */
export const solvePOTD = async (req, res) => {
  try {
    const { submissionId, language } = req.body;

    const potd = await PublishedPOTD.getToday();

    if (!potd) {
      return res.status(404).json({
        success: false,
        message: "No POTD available for today",
      });
    }

    // Check if POTD is still active
    const now = new Date();
    if (now < potd.startTime || now > potd.endTime) {
      return res.status(400).json({
        success: false,
        message: "POTD time has expired. Solution not counted for streak.",
      });
    }

    // Get or create tracking entry
    let tracking = await UserPOTDTracking.getOrCreate(
      req.user._id,
      potd._id,
      potd.problemId,
      potd.activeDate
    );

    // Check if already solved
    if (tracking.solved) {
      return res.json({
        success: true,
        data: {
          message: "POTD already solved",
          solvedAt: tracking.solvedAt,
          alreadySolved: true,
        },
      });
    }

    // Mark as solved
    tracking.solved = true;
    tracking.solvedAt = now;
    tracking.bestSubmissionId = submissionId;
    tracking.language = language;

    if (tracking.firstAttemptAt) {
      tracking.timeSpent = Math.floor(
        (now - tracking.firstAttemptAt) / 1000
      );
    }

    await tracking.save();

    // Update POTD stats
    await PublishedPOTD.findByIdAndUpdate(potd._id, {
      $inc: { "stats.totalSolved": 1, "stats.uniqueUsers": 1 },
    });

    // Update user streak
    const streakResult = await UserStreak.updateStreak(
      req.user._id,
      potd.activeDate
    );

    res.json({
      success: true,
      data: {
        message: "Congratulations! POTD solved!",
        solvedAt: tracking.solvedAt,
        timeSpent: tracking.timeSpent,
        streak: {
          currentStreak: streakResult.currentStreak,
          maxStreak: streakResult.maxStreak,
          isNewRecord: streakResult.isNewRecord,
          streakIncreased: streakResult.streakIncreased,
        },
      },
    });
  } catch (error) {
    console.error("Error solving POTD:", error);
    res.status(500).json({
      success: false,
      message: "Failed to record solution",
      error: error.message,
    });
  }
};

/**
 * Get POTD history (past problems)
 * @route GET /api/potd/history
 * @access Public
 */
export const getPOTDHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const history = await PublishedPOTD.find({
      activeDate: { $lt: today },
    })
      .populate("problemId", "title difficulty tags")
      .sort({ activeDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await PublishedPOTD.countDocuments({
      activeDate: { $lt: today },
    });

    // If user is authenticated, get their solve status
    let userSolveStatus = {};
    if (req.user) {
      const potdIds = history.map((h) => h._id);
      const tracking = await UserPOTDTracking.find({
        userId: req.user._id,
        potdId: { $in: potdIds },
      });

      tracking.forEach((t) => {
        userSolveStatus[t.potdId.toString()] = t.solved;
      });
    }

    const historyWithStatus = history.map((h) => ({
      _id: h._id,
      activeDate: h.activeDate,
      problem: h.problemId,
      stats: h.stats,
      solved: userSolveStatus[h._id.toString()] || false,
    }));

    res.json({
      success: true,
      data: {
        history: historyWithStatus,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching POTD history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch POTD history",
      error: error.message,
    });
  }
};

/**
 * Get streak leaderboard
 * @route GET /api/potd/leaderboard
 * @access Public
 */
export const getStreakLeaderboard = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const leaderboard = await UserStreak.getLeaderboard(parseInt(limit));

    const formattedLeaderboard = leaderboard.map((entry, index) => ({
      rank: index + 1,
      user: {
        _id: entry.userId._id,
        name: entry.userId.name,
        profileImage: entry.userId.profileImage,
      },
      currentStreak: entry.currentStreak,
      maxStreak: entry.maxStreak,
      totalPOTDsSolved: entry.totalPOTDsSolved,
    }));

    res.json({
      success: true,
      data: {
        leaderboard: formattedLeaderboard,
      },
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch leaderboard",
      error: error.message,
    });
  }
};

/**
 * Get POTD scheduler status (admin debug)
 * @route GET /api/potd/status
 * @access Private (Admin)
 */
export const getSchedulerStatus = async (req, res) => {
  try {
    const status = potdScheduler.getStatus();
    
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get scheduler status",
      error: error.message,
    });
  }
};

// Helper function to format time remaining
function formatTimeRemaining(ms) {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
