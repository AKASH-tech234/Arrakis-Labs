import Contest from "../models/Contest.js";
import ContestRegistration from "../models/ContestRegistration.js";
import ContestSubmission from "../models/ContestSubmission.js";
import Question from "../models/Question.js";
import leaderboardService from "../services/leaderboardService.js";
import wsServer from "../services/websocketServer.js";
import mongoose from "mongoose";

/**
 * Admin Contest Controller
 * Full CRUD operations for contests (admin only)
 */

// ==========================================
// CONTEST CRUD
// ==========================================

/**
 * Get all contests (admin view with more details)
 * GET /api/admin/contests
 */
export const getAllContests = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;

    const query = { isActive: true };
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { slug: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [contests, total] = await Promise.all([
      Contest.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("createdBy", "email")
        .lean(),
      Contest.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: contests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[Admin Get Contests Error]:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch contests" });
  }
};

/**
 * Get single contest with full details (admin)
 * GET /api/admin/contests/:id
 */
export const getContestById = async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.id)
      .populate("problems.problem", "title difficulty tags")
      .populate("createdBy", "email")
      .populate("updatedBy", "email")
      .lean();

    if (!contest) {
      return res.status(404).json({ success: false, message: "Contest not found" });
    }

    // Get registration count
    const registrationCount = await ContestRegistration.countDocuments({
      contest: contest._id,
    });

    // Get submission count
    const submissionCount = await ContestSubmission.countDocuments({
      contest: contest._id,
    });

    res.status(200).json({
      success: true,
      data: {
        ...contest,
        registrationCount,
        submissionCount,
      },
    });
  } catch (error) {
    console.error("[Admin Get Contest Error]:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch contest" });
  }
};

/**
 * Create new contest
 * POST /api/admin/contests
 */
export const createContest = async (req, res) => {
  try {
    const {
      name,
      description,
      startTime,
      duration,
      problems,
      scoringRules,
      penaltyRules,
      rankingType,
      isPublic,
      requiresRegistration,
      maxParticipants,
      allowLateJoin,
      lateJoinDeadline,
      showLeaderboardDuringContest,
      freezeLeaderboardMinutes,
    } = req.body;

    // Validate required fields
    if (!name || !startTime || !duration) {
      return res.status(400).json({
        success: false,
        message: "Name, startTime, and duration are required",
      });
    }

    // Validate start time is a valid date
    const start = new Date(startTime);
    if (Number.isNaN(start.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid startTime",
      });
    }

    // Validate problems if provided
    let contestProblems = [];
    if (problems && problems.length > 0) {
      // Verify all problems exist
      const problemIds = problems.map((p) => p.problemId);
      const existingProblems = await Question.find({
        _id: { $in: problemIds },
        isActive: true,
      }).select("_id title");

      const existingIds = new Set(existingProblems.map((p) => p._id.toString()));

      for (const p of problems) {
        if (!existingIds.has(p.problemId)) {
          return res.status(400).json({
            success: false,
            message: `Problem not found: ${p.problemId}`,
          });
        }
      }

      // Build contest problems array
      contestProblems = problems.map((p, idx) => ({
        problem: p.problemId,
        order: p.order ?? idx,
        label: p.label || String.fromCharCode(65 + idx), // A, B, C...
        points: p.points ?? 100,
      }));
    }

    const contest = await Contest.create({
      name,
      description: description || "",
      startTime: start,
      duration,
      problems: contestProblems,
      scoringRules: scoringRules || {},
      penaltyRules: penaltyRules || {},
      rankingType: rankingType || "lcb",
      isPublic: isPublic !== false,
      requiresRegistration: requiresRegistration !== false,
      maxParticipants: maxParticipants || 0,
      allowLateJoin: allowLateJoin !== false,
      lateJoinDeadline: lateJoinDeadline || 30,
      showLeaderboardDuringContest: showLeaderboardDuringContest !== false,
      freezeLeaderboardMinutes: freezeLeaderboardMinutes || 0,
      status: "draft",
      createdBy: req.admin._id,
    });

    res.status(201).json({
      success: true,
      message: "Contest created successfully",
      data: contest,
    });
  } catch (error) {
    console.error("[Admin Create Contest Error]:", error.message);
    res.status(500).json({ success: false, message: "Failed to create contest" });
  }
};

/**
 * Update contest
 * PUT /api/admin/contests/:id
 */
export const updateContest = async (req, res) => {
  try {
    const contestId = req.params.id;
    const updates = req.body;

    const contest = await Contest.findById(contestId);

    if (!contest) {
      return res.status(404).json({ success: false, message: "Contest not found" });
    }

    // Can't update live/ended contests (except certain fields)
    if (contest.status === "live" || contest.status === "ended") {
      const allowedUpdates = ["description", "editorial", "editorialVisible"];
      const updateKeys = Object.keys(updates);
      const invalidUpdates = updateKeys.filter((k) => !allowedUpdates.includes(k));

      if (invalidUpdates.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot update ${invalidUpdates.join(", ")} for ${contest.status} contest`,
        });
      }
    }

    // Handle problems update
    if (updates.problems && Array.isArray(updates.problems)) {
      const problemIds = updates.problems.map((p) => p.problemId || p.problem);
      const existingProblems = await Question.find({
        _id: { $in: problemIds },
        isActive: true,
      });

      const existingIds = new Set(existingProblems.map((p) => p._id.toString()));

      updates.problems = updates.problems.map((p, idx) => {
        const pid = p.problemId || p.problem;
        if (!existingIds.has(pid.toString())) {
          throw new Error(`Problem not found: ${pid}`);
        }
        return {
          problem: pid,
          order: p.order ?? idx,
          label: p.label || String.fromCharCode(65 + idx),
          points: p.points ?? 100,
        };
      });
    }

    // Update fields
    Object.keys(updates).forEach((key) => {
      if (key !== "_id" && key !== "createdBy") {
        contest[key] = updates[key];
      }
    });

    contest.updatedBy = req.admin._id;
    await contest.save();

    res.status(200).json({
      success: true,
      message: "Contest updated successfully",
      data: contest,
    });
  } catch (error) {
    console.error("[Admin Update Contest Error]:", error.message);
    res.status(500).json({ success: false, message: error.message || "Failed to update contest" });
  }
};

/**
 * Delete contest (soft delete)
 * DELETE /api/admin/contests/:id
 */
export const deleteContest = async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.id);

    if (!contest) {
      return res.status(404).json({ success: false, message: "Contest not found" });
    }

    if (contest.status === "live") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete a live contest. Cancel it first.",
      });
    }

    contest.isActive = false;
    contest.updatedBy = req.admin._id;
    await contest.save();

    res.status(200).json({
      success: true,
      message: "Contest deleted successfully",
    });
  } catch (error) {
    console.error("[Admin Delete Contest Error]:", error.message);
    res.status(500).json({ success: false, message: "Failed to delete contest" });
  }
};

// ==========================================
// CONTEST LIFECYCLE MANAGEMENT
// ==========================================

/**
 * Publish contest (draft -> scheduled)
 * POST /api/admin/contests/:id/publish
 */
export const publishContest = async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.id);

    if (!contest) {
      return res.status(404).json({ success: false, message: "Contest not found" });
    }

    if (contest.status !== "draft") {
      return res.status(400).json({
        success: false,
        message: `Cannot publish contest in ${contest.status} status`,
      });
    }

    // Validate contest is ready
    if (contest.problems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Contest must have at least one problem",
      });
    }

    const now = new Date();
    const startTime = new Date(contest.startTime);
    const endTime = contest.endTime
      ? new Date(contest.endTime)
      : new Date(startTime.getTime() + contest.duration * 60 * 1000);

    // If the contest would already be over, don't allow publishing.
    if (now >= endTime) {
      return res.status(400).json({
        success: false,
        message: "Contest end time is in the past; update start time/duration before publishing",
      });
    }

    // If the contest has already started, publish it as live for immediate participation.
    contest.status = now >= startTime ? "live" : "scheduled";
    contest.updatedBy = req.admin._id;
    await contest.save();

    // Initialize Redis leaderboard
    await leaderboardService.initializeContest(contest._id.toString(), contest.duration);

    res.status(200).json({
      success: true,
      message: "Contest published successfully",
      data: contest,
    });
  } catch (error) {
    console.error("[Admin Publish Contest Error]:", error.message);
    res.status(500).json({ success: false, message: "Failed to publish contest" });
  }
};

/**
 * Cancel contest
 * POST /api/admin/contests/:id/cancel
 */
export const cancelContest = async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.id);

    if (!contest) {
      return res.status(404).json({ success: false, message: "Contest not found" });
    }

    if (contest.status === "ended" || contest.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel contest in ${contest.status} status`,
      });
    }

    contest.status = "cancelled";
    contest.updatedBy = req.admin._id;
    await contest.save();

    // Notify participants
    wsServer.notifyContestStatus(contest._id.toString(), "cancelled", {
      message: req.body.reason || "Contest has been cancelled by admin",
    });

    res.status(200).json({
      success: true,
      message: "Contest cancelled successfully",
    });
  } catch (error) {
    console.error("[Admin Cancel Contest Error]:", error.message);
    res.status(500).json({ success: false, message: "Failed to cancel contest" });
  }
};

/**
 * Manually start contest (for testing)
 * POST /api/admin/contests/:id/start
 */
export const startContest = async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.id);

    if (!contest) {
      return res.status(404).json({ success: false, message: "Contest not found" });
    }

    if (contest.status !== "scheduled") {
      return res.status(400).json({
        success: false,
        message: `Cannot start contest in ${contest.status} status`,
      });
    }

    // Update start time to now
    const now = new Date();
    contest.startTime = now;
    contest.endTime = new Date(now.getTime() + contest.duration * 60 * 1000);
    contest.status = "live";
    contest.updatedBy = req.admin._id;
    await contest.save();

    // Notify participants
    wsServer.notifyContestStart(contest._id.toString(), contest.endTime);

    res.status(200).json({
      success: true,
      message: "Contest started successfully",
      data: {
        startTime: contest.startTime,
        endTime: contest.endTime,
      },
    });
  } catch (error) {
    console.error("[Admin Start Contest Error]:", error.message);
    res.status(500).json({ success: false, message: "Failed to start contest" });
  }
};

/**
 * Manually end contest
 * POST /api/admin/contests/:id/end
 */
export const endContest = async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.id);

    if (!contest) {
      return res.status(404).json({ success: false, message: "Contest not found" });
    }

    if (contest.status !== "live") {
      return res.status(400).json({
        success: false,
        message: `Cannot end contest in ${contest.status} status`,
      });
    }

    contest.endTime = new Date();
    contest.status = "ended";
    contest.updatedBy = req.admin._id;
    await contest.save();

    // Freeze leaderboard
    await leaderboardService.freezeLeaderboard(contest._id.toString());

    // Notify participants
    wsServer.notifyContestEnd(contest._id.toString());

    // Calculate final ranks
    await calculateFinalRanks(contest._id);

    res.status(200).json({
      success: true,
      message: "Contest ended successfully",
    });
  } catch (error) {
    console.error("[Admin End Contest Error]:", error.message);
    res.status(500).json({ success: false, message: "Failed to end contest" });
  }
};

// ==========================================
// PARTICIPANT MANAGEMENT
// ==========================================

/**
 * Get contest registrations
 * GET /api/admin/contests/:id/registrations
 */
export const getRegistrations = async (req, res) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    const contestId = req.params.id;

    const query = { contest: contestId };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [registrations, total] = await Promise.all([
      ContestRegistration.find(query)
        .sort({ finalScore: -1, totalTime: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("user", "name email profileImage")
        .lean(),
      ContestRegistration.countDocuments(query),
    ]);

    // Add ranks
    const ranked = registrations.map((reg, idx) => ({
      ...reg,
      rank: skip + idx + 1,
    }));

    res.status(200).json({
      success: true,
      data: ranked,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[Admin Get Registrations Error]:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch registrations" });
  }
};

/**
 * Disqualify a participant
 * POST /api/admin/contests/:id/disqualify/:userId
 */
export const disqualifyParticipant = async (req, res) => {
  try {
    const { id: contestId, userId } = req.params;
    const { reason } = req.body;

    const registration = await ContestRegistration.findOne({
      contest: contestId,
      user: userId,
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Registration not found",
      });
    }

    registration.status = "disqualified";
    registration.disqualifiedReason = reason || "Violation of contest rules";
    registration.disqualifiedAt = new Date();
    registration.disqualifiedBy = req.admin._id;
    await registration.save();

    res.status(200).json({
      success: true,
      message: "Participant disqualified successfully",
    });
  } catch (error) {
    console.error("[Admin Disqualify Error]:", error.message);
    res.status(500).json({ success: false, message: "Failed to disqualify participant" });
  }
};

// ==========================================
// SUBMISSIONS MANAGEMENT
// ==========================================

/**
 * Get all contest submissions (admin view)
 * GET /api/admin/contests/:id/submissions
 */
export const getContestSubmissions = async (req, res) => {
  try {
    const { page = 1, limit = 50, verdict, problemId, userId } = req.query;
    const contestId = req.params.id;

    const query = { contest: contestId };
    if (verdict) query.verdict = verdict;
    if (problemId) query.problem = problemId;
    if (userId) query.user = userId;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [submissions, total] = await Promise.all([
      ContestSubmission.find(query)
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("user", "name email")
        .populate("problem", "title")
        .select("-testResults")
        .lean(),
      ContestSubmission.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: submissions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[Admin Get Submissions Error]:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch submissions" });
  }
};

/**
 * Get submission code (admin only)
 * GET /api/admin/contests/:id/submissions/:submissionId/code
 */
export const getSubmissionCode = async (req, res) => {
  try {
    const { submissionId } = req.params;

    const submission = await ContestSubmission.findById(submissionId)
      .populate("user", "name email")
      .populate("problem", "title")
      .lean();

    if (!submission) {
      return res.status(404).json({ success: false, message: "Submission not found" });
    }

    res.status(200).json({
      success: true,
      data: {
        id: submission._id,
        user: submission.user,
        problem: submission.problem,
        code: submission.code,
        language: submission.language,
        verdict: submission.verdict,
        submittedAt: submission.submittedAt,
        testResults: submission.testResults,
      },
    });
  } catch (error) {
    console.error("[Admin Get Submission Code Error]:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch submission" });
  }
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Calculate and store final ranks after contest ends
 */
async function calculateFinalRanks(contestId) {
  try {
    const registrations = await ContestRegistration.find({
      contest: contestId,
      status: { $in: ["participating", "completed"] },
    }).sort({
      finalScore: -1,
      problemsSolved: -1,
      totalTime: 1,
      totalPenalty: 1,
    });

    let rank = 1;
    for (const reg of registrations) {
      reg.finalRank = rank++;
      reg.status = "completed";
      await reg.save();
    }

    // Update contest stats
    await Contest.findByIdAndUpdate(contestId, {
      "stats.participatedCount": registrations.length,
    });

    console.log(`[Contest] Final ranks calculated for ${contestId}`);
  } catch (error) {
    console.error("[Calculate Ranks Error]:", error.message);
  }
}

/**
 * Send announcement to contest participants
 * POST /api/admin/contests/:id/announce
 */
export const sendAnnouncement = async (req, res) => {
  try {
    const { id: contestId } = req.params;
    const { message, priority } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Announcement message is required",
      });
    }

    const contest = await Contest.findById(contestId);
    if (!contest) {
      return res.status(404).json({ success: false, message: "Contest not found" });
    }

    wsServer.sendAnnouncement(contestId, message, priority || "normal");

    res.status(200).json({
      success: true,
      message: "Announcement sent successfully",
    });
  } catch (error) {
    console.error("[Admin Announce Error]:", error.message);
    res.status(500).json({ success: false, message: "Failed to send announcement" });
  }
};

export default {
  getAllContests,
  getContestById,
  createContest,
  updateContest,
  deleteContest,
  publishContest,
  cancelContest,
  startContest,
  endContest,
  getRegistrations,
  disqualifyParticipant,
  getContestSubmissions,
  getSubmissionCode,
  sendAnnouncement,
};
