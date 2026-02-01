/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * USER INTEGRITY CONTROLLER
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Controller for user-facing integrity/plagiarism status endpoints.
 * Users can view their flagged submissions and submit appeals.
 */

import { PlagiarismResult } from "../../models/plagiarism/index.js";
import PlagiarismAppeal from "../../models/PlagiarismAppeal.js";
import Contest from "../../models/contest/Contest.js";
import mongoose from "mongoose";

/**
 * Get user's overall integrity status
 */
export const getMyIntegrityStatus = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get all plagiarism results for this user
    const results = await PlagiarismResult.find({
      $or: [
        { "user1.userId": userId },
        { "user2.userId": userId },
      ],
    })
      .populate("contestId", "name startTime")
      .sort({ createdAt: -1 });

    // Calculate overall status
    const hasConfirmed = results.some(r => r.status === "confirmed");
    const hasFlagged = results.some(r => r.status === "flagged" || r.status === "pending_review");
    const hasAppealing = results.some(r => r.status === "appealed");

    let overallStatus = "clean";
    if (hasConfirmed) overallStatus = "violated";
    else if (hasAppealing) overallStatus = "appealing";
    else if (hasFlagged) overallStatus = "flagged";

    // Get pending appeals count
    const pendingAppeals = await PlagiarismAppeal.countDocuments({
      userId,
      status: "pending",
    });

    // Group results by contest
    const contestMap = new Map();
    
    for (const result of results) {
      const contestId = result.contestId?._id?.toString();
      if (!contestId) continue;
      
      if (!contestMap.has(contestId)) {
        contestMap.set(contestId, {
          id: contestId,
          title: result.contestId.name,
          date: result.contestId.startTime,
          flags: [],
          status: "clear",
          flaggedCount: 0,
        });
      }
      
      const contest = contestMap.get(contestId);
      
      // Determine which side of the comparison this user is
      const isUser1 = result.user1?.userId?.toString() === userId.toString();
      const userInfo = isUser1 ? result.user1 : result.user2;
      
      // Check if user has already appealed this result
      const existingAppeal = await PlagiarismAppeal.findOne({
        userId,
        resultId: result._id,
      });
      
      contest.flags.push({
        id: result._id.toString(),
        problem: result.problemId?.title || `Problem ${result.problemId}`,
        similarity: result.similarityScore,
        status: result.status,
        canAppeal: result.status !== "cleared" && result.status !== "appealed" && !existingAppeal,
        appealStatus: existingAppeal?.status || null,
      });
      
      contest.flaggedCount++;
      
      // Update contest status based on worst flag
      if (result.status === "confirmed") {
        contest.status = "confirmed";
      } else if (result.status === "appealed" && contest.status !== "confirmed") {
        contest.status = "appealed";
      } else if ((result.status === "flagged" || result.status === "pending_review") && 
                 contest.status !== "confirmed" && contest.status !== "appealed") {
        contest.status = "flagged";
      }
    }

    // Get total contests participated
    const totalContests = await Contest.countDocuments({
      "participants.userId": userId,
    });

    res.json({
      success: true,
      data: {
        status: overallStatus,
        totalContests,
        flaggedCount: results.length,
        pendingAppeals,
        contests: Array.from(contestMap.values()),
      },
    });
  } catch (error) {
    console.error("Error fetching integrity status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch integrity status",
    });
  }
};

/**
 * Get integrity details for a specific contest
 */
export const getContestIntegrityDetails = async (req, res) => {
  try {
    const userId = req.user._id;
    const { contestId } = req.params;

    const results = await PlagiarismResult.find({
      contestId,
      $or: [
        { "user1.userId": userId },
        { "user2.userId": userId },
      ],
    })
      .populate("contestId", "name")
      .populate("problemId", "title");

    const flags = await Promise.all(
      results.map(async (result) => {
        const existingAppeal = await PlagiarismAppeal.findOne({
          userId,
          resultId: result._id,
        });

        return {
          id: result._id.toString(),
          problem: result.problemId?.title || "Unknown Problem",
          similarity: result.similarityScore,
          matchType: result.matchType,
          status: result.status,
          canAppeal: result.status !== "cleared" && result.status !== "appealed" && !existingAppeal,
          appealStatus: existingAppeal?.status || null,
          appealId: existingAppeal?._id?.toString() || null,
          detectedAt: result.createdAt,
        };
      })
    );

    res.json({
      success: true,
      data: {
        contestId,
        contestName: results[0]?.contestId?.name || "Contest",
        flags,
      },
    });
  } catch (error) {
    console.error("Error fetching contest integrity details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch contest details",
    });
  }
};

/**
 * Submit an appeal for a flagged result
 */
export const submitAppeal = async (req, res) => {
  try {
    const userId = req.user._id;
    const { resultId, reason, explanation } = req.body;

    // Validate result exists and belongs to user
    const result = await PlagiarismResult.findById(resultId);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Plagiarism result not found",
      });
    }

    // Check user is part of this result
    const isUser1 = result.user1?.userId?.toString() === userId.toString();
    const isUser2 = result.user2?.userId?.toString() === userId.toString();
    
    if (!isUser1 && !isUser2) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to appeal this result",
      });
    }

    // Check if already appealed
    const existingAppeal = await PlagiarismAppeal.findOne({
      userId,
      resultId,
    });

    if (existingAppeal) {
      return res.status(400).json({
        success: false,
        message: "You have already submitted an appeal for this result",
      });
    }

    // Create appeal
    const appeal = await PlagiarismAppeal.create({
      userId,
      resultId,
      contestId: result.contestId,
      reason,
      explanation,
      status: "pending",
      submittedAt: new Date(),
    });

    // Update result status
    await PlagiarismResult.findByIdAndUpdate(resultId, {
      status: "appealed",
    });

    res.status(201).json({
      success: true,
      message: "Appeal submitted successfully",
      data: {
        appealId: appeal._id.toString(),
        status: appeal.status,
      },
    });
  } catch (error) {
    console.error("Error submitting appeal:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit appeal",
    });
  }
};

/**
 * Get status of an appeal
 */
export const getAppealStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const { appealId } = req.params;

    const appeal = await PlagiarismAppeal.findOne({
      _id: appealId,
      userId,
    })
      .populate("resultId")
      .populate("contestId", "name");

    if (!appeal) {
      return res.status(404).json({
        success: false,
        message: "Appeal not found",
      });
    }

    res.json({
      success: true,
      data: {
        id: appeal._id.toString(),
        status: appeal.status,
        reason: appeal.reason,
        explanation: appeal.explanation,
        contestName: appeal.contestId?.name,
        submittedAt: appeal.submittedAt,
        reviewedAt: appeal.reviewedAt,
        reviewNotes: appeal.status !== "pending" ? appeal.reviewNotes : null,
        decision: appeal.decision,
      },
    });
  } catch (error) {
    console.error("Error fetching appeal status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch appeal status",
    });
  }
};
