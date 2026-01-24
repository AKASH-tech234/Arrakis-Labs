import mongoose from "mongoose";
import SolutionPost from "../models/SolutionPost.js";
import DiscussionThread from "../models/DiscussionThread.js";
import DiscussionMessage from "../models/DiscussionMessage.js";
import Submission from "../models/Submission.js";
import Question from "../models/Question.js";

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function parseIntSafe(value, fallback) {
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : fallback;
}

function clampString(value, { maxLen, trim = true } = {}) {
  if (typeof value !== "string") return "";
  let s = value.replace(/\u0000/g, "");
  if (trim) s = s.trim();
  if (typeof maxLen === "number" && maxLen > 0 && s.length > maxLen) {
    s = s.slice(0, maxLen);
  }
  return s;
}

function rejectIfUnsafeMarkdown(md) {
  const s = String(md || "").toLowerCase();
  // Defense-in-depth: frontend skips raw HTML, but we still reject obvious script/link vectors.
  if (s.includes("<script")) return "Markdown contains forbidden script tags";
  if (s.includes("javascript:")) return "Markdown contains forbidden javascript: links";
  if (s.includes("data:text/html")) return "Markdown contains forbidden data:text/html links";
  return null;
}

export const listProblemDiscussions = async (req, res) => {
  try {
    const problemId = req.params.id || req.params.problemId;
    if (!problemId || !isValidObjectId(problemId)) {
      return res.status(400).json({ success: false, message: "Invalid problem id" });
    }

    const sort = String(req.query.sort || "top"); // top | new
    const language = req.query.language ? String(req.query.language) : null;
    const page = Math.max(1, parseIntSafe(req.query.page, 1));
    const limit = Math.min(50, Math.max(1, parseIntSafe(req.query.limit, 20)));
    const skip = (page - 1) * limit;

    const query = { problemId };
    if (language) query.language = language;

    const sortSpec =
      sort === "new" ? { createdAt: -1 } : { score: -1, upvoteCount: -1, createdAt: -1 };

    const viewerUserId = req.user?._id;

    const [posts, total] = await Promise.all([
      SolutionPost.find(query)
        .sort(sortSpec)
        .skip(skip)
        .limit(limit)
        .populate("userId", "name profileImage")
        .lean(),
      SolutionPost.countDocuments(query),
    ]);

    const mapped = posts.map((p) => {
      const up = Array.isArray(p.votersUp) ? p.votersUp : [];
      const down = Array.isArray(p.votersDown) ? p.votersDown : [];
      const viewer = viewerUserId ? viewerUserId.toString() : null;
      const viewerVote = !viewer
        ? 0
        : up.some((id) => id.toString() === viewer)
          ? 1
          : down.some((id) => id.toString() === viewer)
            ? -1
            : 0;

      return {
        id: p._id,
        problemId: p.problemId,
        threadId: p.threadId,
        submissionId: p.submissionId,
        language: p.language,
        code: p.code,
        explanationMd: p.explanationMd,
        timeComplexity: p.timeComplexity,
        spaceComplexity: p.spaceComplexity,
        approachTags: p.approachTags,
        isVerified: p.isVerified,
        upvoteCount: p.upvoteCount,
        downvoteCount: p.downvoteCount,
        score: p.score,
        commentCount: p.commentCount,
        badges: p.badges,
        viewerVote,
        createdAt: p.createdAt,
        user: p.userId,
      };
    });

    return res.json({
      success: true,
      data: {
        posts: mapped,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to load discussions" });
  }
};

export const createSolutionPost = async (req, res) => {
  try {
    const problemId = req.params.id || req.params.problemId;
    if (!problemId || !isValidObjectId(problemId)) {
      return res.status(400).json({ success: false, message: "Invalid problem id" });
    }

    const userId = req.user?._id;
    const { submissionId, explanationMd, timeComplexity, spaceComplexity, approachTags } = req.body || {};

    if (!submissionId || !isValidObjectId(submissionId)) {
      return res.status(400).json({ success: false, message: "submissionId is required" });
    }

    const submission = await Submission.findOne({
      _id: submissionId,
      userId,
      isRun: false,
    }).lean();

    if (!submission) {
      return res.status(404).json({ success: false, message: "Submission not found" });
    }

    if (String(submission.questionId) !== String(problemId)) {
      return res.status(400).json({ success: false, message: "Submission does not match this problem" });
    }

    const isAccepted =
      submission.status === "accepted" &&
      Number(submission.passedCount) === Number(submission.totalCount) &&
      Number(submission.totalCount) > 0;

    if (!isAccepted) {
      return res.status(403).json({
        success: false,
        message: "You can post your solution after passing all test cases.",
      });
    }

    const cleanedExplanation = clampString(explanationMd, { maxLen: 8000, trim: true });
    const cleanedTime = clampString(timeComplexity, { maxLen: 64, trim: true });
    const cleanedSpace = clampString(spaceComplexity, { maxLen: 64, trim: true });
    const tags = Array.isArray(approachTags)
      ? approachTags
          .map((t) => clampString(String(t), { maxLen: 24, trim: true }))
          .filter(Boolean)
          .slice(0, 10)
      : [];

    const mdErr = rejectIfUnsafeMarkdown(cleanedExplanation);
    if (mdErr) {
      return res.status(400).json({ success: false, message: mdErr });
    }

    const question = await Question.findById(problemId).select("title").lean();

    // Best-effort: prevent spam duplicates for same accepted submission
    const existing = await SolutionPost.findOne({ submissionId }).select("_id").lean();
    if (existing) {
      return res.status(200).json({
        success: true,
        data: { solutionPostId: existing._id },
        message: "Solution already posted",
      });
    }

    const firstSolution = (await SolutionPost.countDocuments({ problemId })) === 0;

    const post = await SolutionPost.create({
      problemId,
      userId,
      submissionId,
      language: submission.language,
      code: submission.code,
      explanationMd: cleanedExplanation,
      timeComplexity: cleanedTime,
      spaceComplexity: cleanedSpace,
      approachTags: tags,
      isVerified: true,
      badges: firstSolution ? ["first_accepted_solution"] : [],
    });

    const threadTitle = question?.title
      ? `${question.title} • ${submission.language.toUpperCase()}`
      : `Solution • ${submission.language.toUpperCase()}`;

    const thread = await DiscussionThread.create({
      problemId,
      type: "solution",
      title: threadTitle,
      createdBy: userId,
      solutionPostId: post._id,
      messageCount: 0,
      lastMessageAt: null,
    });

    post.threadId = thread._id;
    await post.save();

    return res.status(201).json({
      success: true,
      data: {
        post: (await SolutionPost.findById(post._id).populate("userId", "name profileImage")).toObject(),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to post solution" });
  }
};

export const listThreadMessages = async (req, res) => {
  try {
    const { threadId } = req.params;
    if (!threadId || !isValidObjectId(threadId)) {
      return res.status(400).json({ success: false, message: "Invalid thread id" });
    }

    const thread = await DiscussionThread.findById(threadId).select("problemId").lean();
    if (!thread) {
      return res.status(404).json({ success: false, message: "Thread not found" });
    }

    const messages = await DiscussionMessage.find({ threadId })
      .sort({ createdAt: 1 })
      .populate("userId", "name profileImage")
      .lean();

    return res.json({
      success: true,
      data: {
        threadId,
        problemId: thread.problemId,
        messages: messages.map((m) => ({
          id: m._id,
          threadId: m.threadId,
          problemId: m.problemId,
          parentMessageId: m.parentMessageId,
          bodyMd: m.bodyMd,
          createdAt: m.createdAt,
          user: m.userId,
        })),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to load messages" });
  }
};

export const postComment = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { threadId, solutionPostId, parentMessageId, bodyMd } = req.body || {};

    let resolvedThreadId = threadId;
    let resolvedPostId = solutionPostId;

    if (!resolvedThreadId && resolvedPostId) {
      if (!isValidObjectId(resolvedPostId)) {
        return res.status(400).json({ success: false, message: "Invalid solutionPostId" });
      }
      const post = await SolutionPost.findById(resolvedPostId).select("threadId problemId").lean();
      if (!post?.threadId) {
        return res.status(404).json({ success: false, message: "Solution thread not found" });
      }
      resolvedThreadId = post.threadId;
    }

    if (!resolvedThreadId || !isValidObjectId(resolvedThreadId)) {
      return res.status(400).json({ success: false, message: "threadId is required" });
    }

    if (parentMessageId && !isValidObjectId(parentMessageId)) {
      return res.status(400).json({ success: false, message: "Invalid parentMessageId" });
    }

    if (!bodyMd || typeof bodyMd !== "string" || !bodyMd.trim()) {
      return res.status(400).json({ success: false, message: "bodyMd is required" });
    }

    const cleanedBody = clampString(bodyMd, { maxLen: 2000, trim: true });
    const bodyErr = rejectIfUnsafeMarkdown(cleanedBody);
    if (bodyErr) {
      return res.status(400).json({ success: false, message: bodyErr });
    }

    const thread = await DiscussionThread.findById(resolvedThreadId).lean();
    if (!thread) {
      return res.status(404).json({ success: false, message: "Thread not found" });
    }

    if (parentMessageId) {
      const parent = await DiscussionMessage.findOne({ _id: parentMessageId, threadId: resolvedThreadId })
        .select("_id")
        .lean();
      if (!parent) {
        return res.status(400).json({ success: false, message: "Parent message not found in this thread" });
      }
    }

    const msg = await DiscussionMessage.create({
      problemId: thread.problemId,
      threadId: resolvedThreadId,
      userId,
      parentMessageId: parentMessageId || null,
      bodyMd: cleanedBody,
    });

    await DiscussionThread.updateOne(
      { _id: resolvedThreadId },
      { $inc: { messageCount: 1 }, $set: { lastMessageAt: new Date() } }
    );

    if (resolvedPostId && isValidObjectId(resolvedPostId)) {
      await SolutionPost.updateOne({ _id: resolvedPostId }, { $inc: { commentCount: 1 } });
    } else if (thread.solutionPostId) {
      await SolutionPost.updateOne({ _id: thread.solutionPostId }, { $inc: { commentCount: 1 } });
      resolvedPostId = thread.solutionPostId;
    }

    const hydrated = await DiscussionMessage.findById(msg._id).populate("userId", "name profileImage").lean();

    return res.status(201).json({
      success: true,
      data: {
        message: {
          id: hydrated._id,
          threadId: hydrated.threadId,
          problemId: hydrated.problemId,
          parentMessageId: hydrated.parentMessageId,
          bodyMd: hydrated.bodyMd,
          createdAt: hydrated.createdAt,
          user: hydrated.userId,
        },
        solutionPostId: resolvedPostId || null,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to post comment" });
  }
};

export const voteSolution = async (req, res) => {
  try {
    const { solutionPostId } = req.params;
    const userId = req.user?._id;

    if (!solutionPostId || !isValidObjectId(solutionPostId)) {
      return res.status(400).json({ success: false, message: "Invalid solutionPostId" });
    }

    const value = Number(req.body?.value);
    if (![1, 0, -1].includes(value)) {
      return res.status(400).json({ success: false, message: "value must be 1, 0, or -1" });
    }

    const post = await SolutionPost.findById(solutionPostId);
    if (!post) {
      return res.status(404).json({ success: false, message: "Solution post not found" });
    }

    const uid = userId.toString();
    const up = new Set((post.votersUp || []).map((id) => id.toString()));
    const down = new Set((post.votersDown || []).map((id) => id.toString()));

    up.delete(uid);
    down.delete(uid);

    if (value === 1) up.add(uid);
    if (value === -1) down.add(uid);

    post.votersUp = Array.from(up).map((id) => new mongoose.Types.ObjectId(id));
    post.votersDown = Array.from(down).map((id) => new mongoose.Types.ObjectId(id));
    post.upvoteCount = post.votersUp.length;
    post.downvoteCount = post.votersDown.length;
    post.score = post.upvoteCount - post.downvoteCount;

    await post.save();

    return res.json({
      success: true,
      data: {
        solutionPostId: post._id,
        upvoteCount: post.upvoteCount,
        downvoteCount: post.downvoteCount,
        score: post.score,
        viewerVote: value,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to vote" });
  }
};
