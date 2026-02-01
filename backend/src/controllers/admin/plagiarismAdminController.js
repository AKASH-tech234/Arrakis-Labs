/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PLAGIARISM ADMIN CONTROLLER
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Admin API endpoints for plagiarism detection management:
 * - Trigger plagiarism checks
 * - View detection status and results
 * - Review flagged submissions
 * - Manage cheating groups
 * - Override penalties
 */

import { PlagiarismCheck, PlagiarismResult, CheatingGroup, ProcessedSubmission } from "../../models/plagiarism/index.js";
import { PlagiarismDetectionService, getJobRunner } from "../../services/plagiarism/index.js";
import ContestSubmission from "../../models/contest/ContestSubmission.js";
import ContestRegistration from "../../models/contest/ContestRegistration.js";
import Contest from "../../models/contest/Contest.js";
import User from "../../models/auth/User.js";

/**
 * Trigger plagiarism detection for a contest
 * POST /api/admin/plagiarism/contests/:contestId/run
 */
export const runPlagiarismCheck = async (req, res) => {
  try {
    const { contestId } = req.params;
    const { force = false, async = true } = req.body;

    // Validate contest exists and is ended
    const contest = await Contest.findById(contestId);
    if (!contest) {
      return res.status(404).json({
        success: false,
        message: "Contest not found",
        error: "Contest not found",
      });
    }

    if (contest.status !== "ended" && contest.status !== "locked") {
      return res.status(400).json({
        success: false,
        message: "Contest must be ended before running plagiarism detection",
        error: "Contest must be ended before running plagiarism detection",
        currentStatus: contest.status,
      });
    }

    // Check for existing check
    const existingCheck = await PlagiarismCheck.findOne({ contest: contestId });
    if (existingCheck?.status === "completed" && !force) {
      return res.status(400).json({
        success: false,
        message: "Plagiarism check already completed. Use force=true to re-run.",
        error: "Plagiarism check already completed. Use force=true to re-run.",
        results: existingCheck.results,
      });
    }

    if (async) {
      // Queue for background processing
      const jobRunner = getJobRunner();
      const job = await jobRunner.queueContest(contestId, { force });

      return res.status(202).json({
        success: true,
        message: "Plagiarism check queued",
        jobId: job._id,
        status: job.status,
      });
    } else {
      // Run synchronously (for small contests or testing)
      const service = new PlagiarismDetectionService();
      const result = await service.runDetection(contestId);

      return res.status(200).json({
        success: true,
        message: "Plagiarism check completed",
        results: result.results,
      });
    }
  } catch (error) {
    console.error("Run plagiarism check error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      error: error.message,
    });
  }
};

/**
 * Get plagiarism check status for a contest
 * GET /api/admin/plagiarism/contests/:contestId/status
 */
export const getPlagiarismStatus = async (req, res) => {
  try {
    const { contestId } = req.params;

    const check = await PlagiarismCheck.findOne({ contest: contestId })
      .populate("contest", "name status startTime endTime")
      .lean();

    if (!check) {
      return res.status(404).json({
        success: false,
        message: "No plagiarism check found for this contest",
      });
    }

    const contest = check.contest;
    const problemStatuses = Array.isArray(check.problemStatuses)
      ? check.problemStatuses
      : [];

    const problemStatusByProblemId = {};
    for (const ps of problemStatuses) {
      const key = ps?.problem ? String(ps.problem) : ps?.problemLabel;
      if (key) problemStatusByProblemId[key] = ps;
    }

    return res.json({
      success: true,
      data: {
        contestId: contest?._id || check.contest,
        contestName: contest?.name,
        contestStatus: contest?.status,
        contestStartTime: contest?.startTime,
        contestEndTime: contest?.endTime,

        status: check.status,
        progress: check.progress,
        config: check.config,
        results: check.results,
        startedAt: check.startedAt,
        completedAt: check.completedAt,
        error: check.error,

        problemStatuses,
        problemStatusByProblemId,
      },
    });
  } catch (error) {
    console.error("Get plagiarism status error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch plagiarism status",
    });
  }
};

/**
 * Get plagiarism results for a contest
 * GET /api/admin/plagiarism/contests/:contestId/results
 */
export const getPlagiarismResults = async (req, res) => {
  try {
    const { contestId } = req.params;
    const {
      status = "all",
      minSimilarity = 0,
      page = 1,
      limit = 50,
      sortBy = "similarityScore",
      sortOrder = "desc",
    } = req.query;

    // Import mongoose for ObjectId conversion
    const mongoose = (await import("mongoose")).default;
    let contestObjectId;
    try {
      contestObjectId = new mongoose.Types.ObjectId(contestId);
    } catch {
      return res.status(400).json({ success: false, message: "Invalid contest ID" });
    }

    const query = { contest: contestObjectId };

    if (status !== "all") {
      query.status = status;
    }

    if (minSimilarity > 0) {
      query.similarityScore = { $gte: parseFloat(minSimilarity) };
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const results = await PlagiarismResult.find(query)
      .populate("user1", "name email username")
      .populate("user2", "name email username")
      .populate("problem", "title difficulty")
      .populate("submission1", "language createdAt")
      .populate("submission2", "language createdAt")
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await PlagiarismResult.countDocuments(query);

    // Get summary statistics
    const summary = await PlagiarismResult.aggregate([
      { $match: { contest: contestObjectId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          avgSimilarity: { $avg: "$similarityScore" },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        results,
        total,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
        summary: summary.reduce((acc, s) => {
          acc[s._id] = { count: s.count, avgSimilarity: s.avgSimilarity };
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    console.error("Get plagiarism results error:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get detailed comparison between two submissions
 * GET /api/admin/plagiarism/compare/:resultId
 */
export const getComparisonDetails = async (req, res) => {
  try {
    const { resultId } = req.params;

    const result = await PlagiarismResult.findById(resultId)
      .populate("user1", "name email username")
      .populate("user2", "name email username")
      .populate("problem", "title");

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Comparison not found",
        error: "Comparison not found",
      });
    }

    // Get full submission code
    const [sub1, sub2] = await Promise.all([
      ContestSubmission.findById(result.submission1).select("code language createdAt"),
      ContestSubmission.findById(result.submission2).select("code language createdAt"),
    ]);

    const rawSections = Array.isArray(result.matchingSections) ? result.matchingSections : [];
    const lines1 = [];
    const lines2 = [];
    const sections = rawSections.map((s) => {
      const start1 = Number(s.start1) || 0;
      const end1 = Number(s.end1) || 0;
      const start2 = Number(s.start2) || 0;
      const end2 = Number(s.end2) || 0;

      if (start1 > 0 && end1 >= start1) {
        for (let i = start1; i <= end1; i += 1) lines1.push(i);
      }
      if (start2 > 0 && end2 >= start2) {
        for (let i = start2; i <= end2; i += 1) lines2.push(i);
      }

      return {
        start1,
        end1,
        start2,
        end2,
        similarity: s.similarity,
      };
    });

    res.json({
      success: true,
      data: {
        _id: result._id,
        status: result.status,
        reviewNotes: result.reviewNotes,
        similarityScore: result.similarityScore,
        similarityDetails: {
          cosine: result.similarityDetails?.cosineSimilarity,
          jaccard: result.similarityDetails?.jaccardSimilarity,
          levenshtein: result.similarityDetails?.levenshteinRatio,
          tokenOverlap: result.similarityDetails?.tokenOverlap,
          structural: result.similarityDetails?.structuralSimilarity,
        },
        problem: result.problem,
        user1: result.user1,
        user2: result.user2,
        submission1: {
          _id: sub1?._id,
          code: sub1?.code,
          language: sub1?.language,
          submittedAt: sub1?.createdAt,
        },
        submission2: {
          _id: sub2?._id,
          code: sub2?.code,
          language: sub2?.language,
          submittedAt: sub2?.createdAt,
        },
        matchingSections: {
          sections,
          lines1: Array.from(new Set(lines1)).sort((a, b) => a - b),
          lines2: Array.from(new Set(lines2)).sort((a, b) => a - b),
        },
      },
    });
  } catch (error) {
    console.error("Get comparison details error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      error: error.message,
    });
  }
};

/**
 * Update plagiarism result status (admin review)
 * PATCH /api/admin/plagiarism/results/:resultId
 */
export const updateResultStatus = async (req, res) => {
  try {
    const { resultId } = req.params;
    const { status, reviewNotes } = req.body;

    const validStatuses = ["plagiarism", "review", "safe", "false_positive", "confirmed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const result = await PlagiarismResult.findById(resultId);
    if (!result) {
      return res.status(404).json({ error: "Result not found" });
    }

    await result.markAsReviewed(req.admin._id, status, reviewNotes);

    res.json({
      message: "Result status updated",
      result,
    });
  } catch (error) {
    console.error("Update result status error:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get cheating groups for a contest
 * GET /api/admin/plagiarism/contests/:contestId/groups
 */
export const getCheatingGroups = async (req, res) => {
  try {
    const { contestId } = req.params;
    const { severity, status, page = 1, limit = 20 } = req.query;

    const query = { contest: contestId };
    if (severity) query.severity = severity;
    if (status) query.status = status;

    const groups = await CheatingGroup.find(query)
      .populate("members.user", "name email username")
      .populate("members.affectedProblems", "title")
      .sort({ severity: -1, "members.length": -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await CheatingGroup.countDocuments(query);

    // Summary by severity
    const severitySummary = await CheatingGroup.aggregate([
      { $match: { contest: contestId } },
      {
        $group: {
          _id: "$severity",
          count: { $sum: 1 },
          totalMembers: { $sum: { $size: "$members" } },
        },
      },
    ]);

    res.json({
      groups,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
      severitySummary: severitySummary.reduce((acc, s) => {
        acc[s._id] = { count: s.count, totalMembers: s.totalMembers };
        return acc;
      }, {}),
    });
  } catch (error) {
    console.error("Get cheating groups error:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get details of a specific cheating group
 * GET /api/admin/plagiarism/groups/:groupId
 */
export const getGroupDetails = async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await CheatingGroup.findById(groupId)
      .populate("members.user", "name email username")
      .populate("members.affectedProblems", "title difficulty")
      .populate("contest", "title");

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Get related plagiarism results
    const memberIds = group.members.map((m) => m.user._id);
    const relatedResults = await PlagiarismResult.find({
      contest: group.contest._id,
      user1: { $in: memberIds },
      user2: { $in: memberIds },
    })
      .populate("user1", "name username")
      .populate("user2", "name username")
      .populate("problem", "title")
      .sort({ similarityScore: -1 });

    res.json({
      group,
      relatedResults,
    });
  } catch (error) {
    console.error("Get group details error:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Override penalty for a group member
 * PATCH /api/admin/plagiarism/groups/:groupId/members/:userId
 */
export const overrideMemberPenalty = async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const { action, reason } = req.body;

    const validActions = ["remove_penalty", "apply_penalty", "reduce_penalty"];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        error: `Invalid action. Must be one of: ${validActions.join(", ")}`,
      });
    }

    const group = await CheatingGroup.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    const member = group.members.find((m) => m.user.toString() === userId);
    if (!member) {
      return res.status(404).json({ error: "Member not found in group" });
    }

    // Update registration based on action
    if (action === "remove_penalty") {
      await ContestRegistration.findOneAndUpdate(
        { contest: group.contest, user: userId },
        {
          $set: {
            "disqualified.status": false,
            "disqualified.reason": `Penalty removed by admin: ${reason}`,
          },
        }
      );
      member.penaltyStatus = "overridden";
    } else if (action === "apply_penalty") {
      await ContestRegistration.findOneAndUpdate(
        { contest: group.contest, user: userId },
        {
          $set: {
            "disqualified.status": true,
            "disqualified.reason": `Penalty applied by admin: ${reason}`,
            "disqualified.at": new Date(),
          },
        }
      );
      member.penaltyStatus = "applied";
    }

    // Add admin note
    if (!group.adminNotes) group.adminNotes = [];
    group.adminNotes.push({
      admin: req.admin._id,
      action,
      userId,
      reason,
      timestamp: new Date(),
    });

    await group.save();

    res.json({
      message: `Penalty ${action} for user`,
      group,
    });
  } catch (error) {
    console.error("Override member penalty error:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get plagiarism history for a user
 * GET /api/admin/plagiarism/users/:userId/history
 */
export const getUserPlagiarismHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select("name email username");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get all plagiarism results involving this user
    const results = await PlagiarismResult.find({
      $or: [{ user1: userId }, { user2: userId }],
      status: { $in: ["plagiarism", "review", "confirmed"] },
    })
      .populate("contest", "title startTime")
      .populate("problem", "title")
      .sort({ detectedAt: -1 });

    // Get all groups containing this user
    const groups = await CheatingGroup.find({
      "members.user": userId,
    })
      .populate("contest", "title")
      .select("groupId contest severity status members");

    // Calculate summary
    const summary = {
      totalIncidents: results.length,
      confirmedPlagiarism: results.filter((r) => r.status === "confirmed" || r.status === "plagiarism").length,
      contestsInvolved: [...new Set(results.map((r) => r.contest._id.toString()))].length,
      groupMemberships: groups.length,
    };

    res.json({
      user,
      summary,
      results,
      groups,
    });
  } catch (error) {
    console.error("Get user plagiarism history error:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get dashboard statistics
 * GET /api/admin/plagiarism/dashboard
 */
export const getDashboardStats = async (req, res) => {
  try {
    const { timeRange = "30d" } = req.query;

    // Parse time range
    let startDate = new Date();
    if (timeRange === "7d") startDate.setDate(startDate.getDate() - 7);
    else if (timeRange === "30d") startDate.setDate(startDate.getDate() - 30);
    else if (timeRange === "90d") startDate.setDate(startDate.getDate() - 90);
    else startDate = new Date(0); // all time

    // Get recent checks
    const recentChecks = await PlagiarismCheck.find({
      createdAt: { $gte: startDate },
    })
      .populate("contest", "title")
      .sort({ createdAt: -1 })
      .limit(10);

    // Filter out checks with deleted contests
    const validRecentChecks = recentChecks
      .filter((check) => check.contest)
      .map((check) => {
        const plagiarismPairs = check?.results?.plagiarismPairs || 0;
        const reviewPairs = check?.results?.reviewPairs || 0;
        return {
          ...check.toObject(),
          results: {
            ...(check?.results || {}),
            // UI expects `flaggedCount`; use pairs as a practical proxy.
            flaggedCount: plagiarismPairs + reviewPairs,
          },
        };
      });

    // Get recent cheating groups
    const recentGroups = await CheatingGroup.find({
      detectedAt: { $gte: startDate },
    })
      .sort({ detectedAt: -1 })
      .limit(10);

    // Aggregate statistics
    const checkStats = await PlagiarismCheck.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const resultStats = await PlagiarismResult.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          avgSimilarity: { $avg: "$similarityScore" },
        },
      },
    ]);

    const groupStats = await CheatingGroup.aggregate([
      { $match: { detectedAt: { $gte: startDate } } },
      {
        $group: {
          _id: "$severity",
          count: { $sum: 1 },
          totalMembers: { $sum: { $size: "$members" } },
        },
      },
    ]);

    // Active jobs (non-critical; never fail the dashboard)
    let activeJobs = [];
    try {
      const jobRunner = getJobRunner();
      activeJobs = await jobRunner.getAllJobs();
    } catch (jobError) {
      console.warn("Dashboard: unable to load active jobs:", jobError?.message || jobError);
    }

    const checkCountsByStatus = checkStats.reduce((acc, s) => {
      acc[s._id] = s.count;
      return acc;
    }, {});

    const resultCountsByStatus = resultStats.reduce((acc, s) => {
      acc[s._id] = { count: s.count, avgSimilarity: s.avgSimilarity };
      return acc;
    }, {});

    const groupCountsBySeverity = groupStats.reduce((acc, s) => {
      acc[s._id] = { count: s.count, totalMembers: s.totalMembers };
      return acc;
    }, {});

    const totalChecks = Object.values(checkCountsByStatus).reduce((sum, value) => sum + (value || 0), 0);
    const totalResults = Object.values(resultCountsByStatus).reduce(
      (sum, value) => sum + (value?.count || 0),
      0
    );

    const flaggedSubmissions =
      (resultCountsByStatus?.plagiarism?.count || 0) +
      (resultCountsByStatus?.confirmed?.count || 0) +
      (resultCountsByStatus?.review?.count || 0);

    const pendingReviews = resultCountsByStatus?.review?.count || 0;
    const activeGroups = Object.values(groupCountsBySeverity).reduce(
      (sum, value) => sum + (value?.count || 0),
      0
    );

    const highRiskGroups =
      (groupCountsBySeverity?.high?.count || 0) + (groupCountsBySeverity?.critical?.count || 0);

    const stats = {
      totalChecks,
      flaggedSubmissions,
      flaggedPercentage: totalResults > 0 ? Math.round((flaggedSubmissions / totalResults) * 100) : 0,
      pendingReviews,
      activeGroups,
      highRiskGroups,
    };

    // Frontend contract: { success, data: { stats, recentChecks, recentGroups } }
    res.json({
      success: true,
      data: {
        stats,
        recentChecks: validRecentChecks,
        recentGroups,
      },
      // Backwards-compatible fields
      timeRange,
      statistics: {
        checks: checkCountsByStatus,
        results: resultCountsByStatus,
        groups: groupCountsBySeverity,
      },
      activeJobs,
    });
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to load dashboard stats",
      error: error?.message,
    });
  }
};

/**
 * Export plagiarism report for a contest
 * GET /api/admin/plagiarism/contests/:contestId/export
 */
export const exportPlagiarismReport = async (req, res) => {
  try {
    const { contestId } = req.params;
    const { format = "json" } = req.query;

    const contest = await Contest.findById(contestId).select("title");
    if (!contest) {
      return res.status(404).json({ error: "Contest not found" });
    }

    const check = await PlagiarismCheck.findOne({ contest: contestId });
    const results = await PlagiarismResult.find({
      contest: contestId,
      status: { $ne: "safe" },
    })
      .populate("user1", "name email username")
      .populate("user2", "name email username")
      .populate("problem", "title");

    const groups = await CheatingGroup.find({ contest: contestId })
      .populate("members.user", "name email username");

    const report = {
      contest: {
        id: contestId,
        title: contest.title,
      },
      generatedAt: new Date(),
      summary: check?.results || {},
      config: check?.config || {},
      flaggedPairs: results.map((r) => ({
        user1: r.user1,
        user2: r.user2,
        problem: r.problem?.title,
        similarity: r.similarityScore,
        status: r.status,
        detectedAt: r.detectedAt,
      })),
      cheatingGroups: groups.map((g) => ({
        groupId: g.groupId,
        severity: g.severity,
        members: g.members.map((m) => ({
          user: m.user,
          avgSimilarity: m.avgSimilarity,
          penaltyStatus: m.penaltyStatus,
        })),
      })),
    };

    if (format === "csv") {
      // Generate CSV
      const csvRows = [
        ["User 1", "User 2", "Problem", "Similarity", "Status", "Detected At"],
        ...results.map((r) => [
          r.user1?.username || r.user1?.email,
          r.user2?.username || r.user2?.email,
          r.problem?.title,
          (r.similarityScore * 100).toFixed(1) + "%",
          r.status,
          r.detectedAt?.toISOString(),
        ]),
      ];

      const csv = csvRows.map((row) => row.join(",")).join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=plagiarism-report-${contestId}.csv`
      );
      return res.send(csv);
    }

    // Default JSON
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=plagiarism-report-${contestId}.json`
    );
    res.json(report);
  } catch (error) {
    console.error("Export plagiarism report error:", error);
    res.status(500).json({ error: error.message });
  }
};
