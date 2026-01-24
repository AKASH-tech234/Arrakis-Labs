import POTDCalendar from "../models/POTDCalendar.js";
import PublishedPOTD from "../models/PublishedPOTD.js";
import UserPOTDTracking from "../models/UserPOTDTracking.js";
import UserStreak from "../models/UserStreak.js";
import Question from "../models/Question.js";
import mongoose from "mongoose";
import Submission from "../models/Submission.js";
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
    const { startDate, endDate, year, month } = req.query;

    let start;
    let end;

    if (year && month) {
      const y = parseInt(year, 10);
      const m = parseInt(month, 10);

      if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
        return res.status(400).json({
          success: false,
          message: "Invalid year/month parameters",
        });
      }

      start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
      end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
    } else if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid startDate/endDate parameters",
        });
      }
    } else {
      // Default to current month in UTC
      const now = new Date();
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    }

    // Normalize to UTC day boundaries
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(23, 59, 59, 999);

    // Get user's POTD tracking records
    const userTracking = await UserPOTDTracking.getUserCalendar(
      req.user._id,
      start,
      end
    );

    const trackingByPotdId = new Map(
      userTracking.map((t) => [t.potdId.toString(), t])
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

      const tracking = trackingByPotdId.get(potd._id.toString());

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
    const { potdId } = req.body;
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

    // Optional client-provided potdId guard
    if (potdId && potdId.toString() !== potd._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "Invalid POTD id for today",
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
    const isFirstAttemptForThisPOTD = tracking.attempts === 0;
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

    // Record attempt in streak once per POTD/day
    if (isFirstAttemptForThisPOTD) {
      await UserStreak.recordAttempt(req.user._id);
    }

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
    const { submissionId, language, potdId } = req.body;

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

    // Optional client-provided potdId guard
    if (potdId && potdId.toString() !== potd._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "Invalid POTD id for today",
      });
    }

    // Validate submission (prevents marking as solved without an accepted submission)
    if (!submissionId || !mongoose.Types.ObjectId.isValid(submissionId)) {
      return res.status(400).json({
        success: false,
        message: "Valid submissionId is required to mark POTD as solved",
      });
    }

    const submission = await Submission.findOne({
      _id: submissionId,
      userId: req.user._id,
      questionId: potd.problemId?._id || potd.problemId,
      isRun: false,
      status: "accepted",
      createdAt: { $gte: potd.startTime, $lte: potd.endTime },
    }).select("_id language createdAt");

    if (!submission) {
      return res.status(400).json({
        success: false,
        message: "Submission is not a valid accepted solution for today's POTD",
      });
    }

    // Get or create tracking entry
    let tracking = await UserPOTDTracking.getOrCreate(
      req.user._id,
      potd._id,
      potd.problemId,
      potd.activeDate
    );

    // Fast path: already solved
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

    // Atomically mark as solved to prevent duplicate stats/streak updates under concurrency.
    const timeSpent = tracking.firstAttemptAt
      ? Math.floor((now - tracking.firstAttemptAt) / 1000)
      : 0;

    const updatedTracking = await UserPOTDTracking.findOneAndUpdate(
      { _id: tracking._id, solved: false },
      {
        $set: {
          solved: true,
          solvedAt: now,
          bestSubmissionId: submission._id,
          language: language || submission.language || null,
          timeSpent,
        },
      },
      { new: true }
    );

    if (!updatedTracking) {
      // Another request solved it first.
      return res.json({
        success: true,
        data: {
          message: "POTD already solved",
          solvedAt: tracking.solvedAt,
          alreadySolved: true,
        },
      });
    }

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
        solvedAt: updatedTracking.solvedAt,
        timeSpent: updatedTracking.timeSpent,
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
