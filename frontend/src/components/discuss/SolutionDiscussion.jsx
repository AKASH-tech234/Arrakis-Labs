import { useEffect, useMemo, useState } from "react";
import {
  ArrowBigDown,
  ArrowBigUp,
  MessageSquarePlus,
  Sparkles,
  Trophy,
} from "lucide-react";
import {
  getProblemDiscussions,
  getThreadMessages,
  postComment,
  postSolution,
  voteSolution,
} from "../../services/common/discussApi";
import MarkdownRenderer from "./MarkdownRenderer";

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "";
  }
}

function buildTree(messages) {
  const byId = new Map();
  const roots = [];

  for (const m of messages) {
    byId.set(m.id, { ...m, replies: [] });
  }

  for (const m of byId.values()) {
    if (m.parentMessageId && byId.has(m.parentMessageId)) {
      byId.get(m.parentMessageId).replies.push(m);
    } else {
      roots.push(m);
    }
  }

  return roots;
}

function CommentNode({ node, depth = 0, onReply }) {
  return (
    <div className={depth ? "ml-4 pl-4 border-l border-[#1A1814]" : ""}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className="text-[#78716C] text-[10px] tracking-[0.25em] uppercase"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {node.user?.name || "User"} • {formatDate(node.createdAt)}
          </div>
          <div className="mt-2 text-[#E8E4D9] text-sm">
            <MarkdownRenderer value={node.bodyMd} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => onReply(node)}
          className="shrink-0 px-3 py-2 rounded border border-[#2A2A24] bg-[#0F0F0D] text-[#E8E4D9] hover:border-[#D97706]/50 transition-all text-xs tracking-[0.2em] uppercase"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          Reply
        </button>
      </div>

      {node.replies?.length ? (
        <div className="mt-4 space-y-4">
          {node.replies.map((r) => (
            <CommentNode key={r.id} node={r} depth={depth + 1} onReply={onReply} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function SolutionDiscussion({ problemId, lastAcceptedSubmission }) {
  const [sort, setSort] = useState("top");
  const [language, setLanguage] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [posts, setPosts] = useState([]);

  const [activePost, setActivePost] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [threadLoading, setThreadLoading] = useState(false);

  const [composerOpen, setComposerOpen] = useState(false);
  const [explanationMd, setExplanationMd] = useState("");
  const [timeComplexity, setTimeComplexity] = useState("");
  const [spaceComplexity, setSpaceComplexity] = useState("");

  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState(null);

  const canPostSolution = Boolean(lastAcceptedSubmission?.submissionId);

  const canPostTooltip = "You can post your solution after passing all test cases.";

  const load = async () => {
    if (!problemId) return;
    setLoading(true);
    setError(null);
    const res = await getProblemDiscussions(problemId, { sort, language: language || undefined, limit: 30 });
    if (!res.success) {
      setError(res.error);
      setPosts([]);
      setLoading(false);
      return;
    }
    setPosts(res.data.posts || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemId, sort, language]);

  const openThread = async (post) => {
    setActivePost(post);
    setReplyTo(null);
    setCommentText("");

    if (!post?.threadId) {
      setThreadMessages([]);
      return;
    }

    setThreadLoading(true);
    const res = await getThreadMessages(post.threadId);
    if (res.success) {
      setThreadMessages(res.data.messages || []);
    }
    setThreadLoading(false);
  };

  const messageTree = useMemo(() => buildTree(threadMessages), [threadMessages]);

  const handleVote = async (postId, nextValue) => {
    const res = await voteSolution(postId, nextValue);
    if (!res.success) return;

    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, ...res.data } : p))
    );

    if (activePost?.id === postId) {
      setActivePost((p) => (p ? { ...p, ...res.data } : p));
    }
  };

  const handlePostSolution = async () => {
    if (!canPostSolution) return;

    const payload = {
      submissionId: lastAcceptedSubmission.submissionId,
      explanationMd,
      timeComplexity,
      spaceComplexity,
    };

    const res = await postSolution(problemId, payload);
    if (!res.success) {
      alert(res.error);
      return;
    }

    setComposerOpen(false);
    setExplanationMd("");
    setTimeComplexity("");
    setSpaceComplexity("");

    await load();
  };

  const handlePostComment = async () => {
    if (!activePost?.threadId) return;
    const body = commentText.trim();
    if (!body) return;

    const res = await postComment({
      threadId: activePost.threadId,
      solutionPostId: activePost.id,
      parentMessageId: replyTo?.id || null,
      bodyMd: body,
    });

    if (!res.success) {
      alert(res.error);
      return;
    }

    setCommentText("");
    setReplyTo(null);

    // Refresh thread + bump comment count UI
    await openThread(activePost);
    setPosts((prev) =>
      prev.map((p) =>
        p.id === activePost.id ? { ...p, commentCount: (p.commentCount || 0) + 1 } : p
      )
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Filters / Actions */}
      <div className="px-6 py-4 border-b border-[#1A1814] bg-[#0F0F0D]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div
              className="text-[#78716C] text-[10px] tracking-[0.25em] uppercase"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Discuss
            </div>
            <div
              className="text-[#E8E4D9] text-sm font-semibold tracking-wider"
              style={{ fontFamily: "'Rajdhani', 'Orbitron', system-ui, sans-serif" }}
            >
              Solutions & discussion
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setComposerOpen((v) => !v)}
              disabled={!canPostSolution}
              title={!canPostSolution ? canPostTooltip : ""}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded border text-xs tracking-[0.2em] uppercase transition-all ${
                canPostSolution
                  ? "border-[#2A2A24] bg-[#0A0A08] text-[#E8E4D9] hover:border-[#D97706]/50"
                  : "border-[#1A1814] bg-[#0A0A08] text-[#3D3D3D] cursor-not-allowed"
              }`}
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              <Sparkles className="w-4 h-4" />
              Post Solution
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="inline-flex rounded-lg border border-[#1A1814] bg-[#0A0A08] p-1">
            <button
              type="button"
              onClick={() => setSort("top")}
              className={`px-3 py-2 rounded-md text-xs tracking-[0.25em] uppercase transition-all ${
                sort === "top" ? "bg-[#0F0F0D] text-[#E8E4D9]" : "text-[#A29A8C] hover:text-[#E8E4D9]"
              }`}
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Top
            </button>
            <button
              type="button"
              onClick={() => setSort("new")}
              className={`px-3 py-2 rounded-md text-xs tracking-[0.25em] uppercase transition-all ${
                sort === "new" ? "bg-[#0F0F0D] text-[#E8E4D9]" : "text-[#A29A8C] hover:text-[#E8E4D9]"
              }`}
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              New
            </button>
          </div>

          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="px-3 py-2 rounded border border-[#2A2A24] bg-[#0A0A08] text-[#E8E4D9] text-xs tracking-[0.2em] uppercase"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            <option value="">All languages</option>
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="java">Java</option>
            <option value="cpp">C++</option>
          </select>
        </div>

        {composerOpen ? (
          <div className="mt-4 rounded-xl border border-[#1A1814] bg-[#0A0A08] p-4">
            <div
              className="text-[#78716C] text-[10px] tracking-[0.25em] uppercase"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Verified submission required
            </div>

            <div className="grid grid-cols-1 gap-3 mt-3">
              <textarea
                value={explanationMd}
                onChange={(e) => setExplanationMd(e.target.value)}
                placeholder="Optional explanation (Markdown supported)…"
                className="w-full min-h-[110px] px-3 py-2 rounded border border-[#1A1814] bg-[#0F0F0D] text-[#E8E4D9] text-sm"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  value={timeComplexity}
                  onChange={(e) => setTimeComplexity(e.target.value)}
                  placeholder="Time complexity (e.g., O(n log n))"
                  className="w-full px-3 py-2 rounded border border-[#1A1814] bg-[#0F0F0D] text-[#E8E4D9] text-sm"
                />
                <input
                  value={spaceComplexity}
                  onChange={(e) => setSpaceComplexity(e.target.value)}
                  placeholder="Space complexity (e.g., O(n))"
                  className="w-full px-3 py-2 rounded border border-[#1A1814] bg-[#0F0F0D] text-[#E8E4D9] text-sm"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  className="px-4 py-2 rounded border border-[#2A2A24] bg-[#0A0A08] text-[#E8E4D9] hover:border-[#D97706]/50 transition-all text-xs tracking-[0.2em] uppercase"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePostSolution}
                  className="px-4 py-2 rounded border border-[#D97706]/40 bg-[#0A0A08] text-[#E8E4D9] hover:border-[#D97706]/70 hover:shadow-[0_0_0_1px_rgba(217,119,6,0.25)] transition-all text-xs tracking-[0.2em] uppercase"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  Publish
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-1 lg:grid-cols-2">
          {/* List */}
          <div className="border-r border-[#1A1814] overflow-auto">
            {loading ? (
              <div className="p-6 text-[#A29A8C]">Loading…</div>
            ) : error ? (
              <div className="p-6 text-red-400">{error}</div>
            ) : posts.length === 0 ? (
              <div className="p-6 text-[#A29A8C]">No solutions posted yet.</div>
            ) : (
              <div className="p-4 space-y-3">
                {posts.map((p, idx) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => openThread(p)}
                    className={`w-full text-left rounded-xl border p-4 transition-colors ${
                      activePost?.id === p.id
                        ? "border-[#D97706]/50 bg-[#0F0F0D]"
                        : "border-[#1A1814] bg-[#0A0A08] hover:bg-[#0D0D0B]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-[#E8E4D9] text-xs tracking-[0.25em] uppercase"
                            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                          >
                            {p.language}
                          </span>
                          {sort === "top" && idx === 0 ? (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-[#D97706]/30 text-[#F59E0B] tracking-wider uppercase">
                              <Trophy className="w-3 h-3" />
                              Top
                            </span>
                          ) : null}
                          {p.isVerified ? (
                            <span className="text-[10px] px-2 py-1 rounded border border-green-500/30 text-green-400 tracking-wider uppercase">
                              Verified
                            </span>
                          ) : null}
                          {Array.isArray(p.badges) && p.badges.includes("first_accepted_solution") ? (
                            <span className="text-[10px] px-2 py-1 rounded border border-[#D97706]/30 text-[#F59E0B] tracking-wider uppercase">
                              First Accepted
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 text-[#A29A8C] text-xs">
                          {p.user?.name || "User"} • {formatDate(p.createdAt)}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const next = p.viewerVote === 1 ? 0 : 1;
                            handleVote(p.id, next);
                          }}
                          className={`w-9 h-9 rounded border flex items-center justify-center transition-colors ${
                            p.viewerVote === 1
                              ? "border-[#D97706]/60 bg-[#0F0F0D]"
                              : "border-[#1A1814] bg-[#0A0A08] hover:border-[#D97706]/40"
                          }`}
                          aria-label="Upvote"
                        >
                          <ArrowBigUp className="w-4 h-4 text-[#E8E4D9]" />
                        </button>
                        <div className="text-[#E8E4D9] text-xs font-mono w-8 text-center">
                          {p.score}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const next = p.viewerVote === -1 ? 0 : -1;
                            handleVote(p.id, next);
                          }}
                          className={`w-9 h-9 rounded border flex items-center justify-center transition-colors ${
                            p.viewerVote === -1
                              ? "border-[#D97706]/60 bg-[#0F0F0D]"
                              : "border-[#1A1814] bg-[#0A0A08] hover:border-[#D97706]/40"
                          }`}
                          aria-label="Downvote"
                        >
                          <ArrowBigDown className="w-4 h-4 text-[#E8E4D9]" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-3 text-[#78716C] text-xs">
                      <span className="font-mono">▲ {p.upvoteCount}</span>
                      <span className="font-mono">▼ {p.downvoteCount}</span>
                      <span className="inline-flex items-center gap-2">
                        <MessageSquarePlus className="w-4 h-4" />
                        <span className="font-mono">{p.commentCount || 0}</span>
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Thread */}
          <div className="overflow-auto">
            {!activePost ? (
              <div className="p-6 text-[#A29A8C]">Select a solution to view its discussion.</div>
            ) : (
              <div className="p-6 space-y-6">
                <div className="rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-4">
                  <div
                    className="text-[#78716C] text-[10px] tracking-[0.25em] uppercase"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    {activePost.user?.name || "User"} • {activePost.language} • {formatDate(activePost.createdAt)}
                  </div>

                  {activePost.timeComplexity || activePost.spaceComplexity ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {activePost.timeComplexity ? (
                        <span className="text-[10px] px-2 py-1 rounded border border-[#2A2A24] text-[#A29A8C] font-mono">
                          Time: {activePost.timeComplexity}
                        </span>
                      ) : null}
                      {activePost.spaceComplexity ? (
                        <span className="text-[10px] px-2 py-1 rounded border border-[#2A2A24] text-[#A29A8C] font-mono">
                          Space: {activePost.spaceComplexity}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  {activePost.explanationMd ? (
                    <div className="mt-4">
                      <MarkdownRenderer value={activePost.explanationMd} />
                    </div>
                  ) : null}

                  <details className="mt-4">
                    <summary className="cursor-pointer text-[#F59E0B] text-xs tracking-[0.2em] uppercase">
                      View code
                    </summary>
                    <pre className="mt-3 p-3 rounded-lg border border-[#1A1814] bg-[#0A0A08] overflow-auto text-xs">
                      <code className="text-[#E8E4D9]" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                        {activePost.code}
                      </code>
                    </pre>
                  </details>
                </div>

                <div>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div
                        className="text-[#E8E4D9] text-xs tracking-[0.25em] uppercase"
                        style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                      >
                        Thread
                      </div>
                      <div className="text-[#78716C] text-xs mt-1">
                        Reply to the solution or to any comment.
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-[#1A1814] bg-[#0A0A08] p-4">
                    {replyTo ? (
                      <div className="mb-3 text-[#A29A8C] text-xs">
                        Replying to <span className="text-[#E8E4D9]">{replyTo.user?.name || "User"}</span>
                        <button
                          type="button"
                          onClick={() => setReplyTo(null)}
                          className="ml-3 text-[#F59E0B] underline"
                        >
                          cancel
                        </button>
                      </div>
                    ) : null}

                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Write a comment (Markdown supported)…"
                      className="w-full min-h-[90px] px-3 py-2 rounded border border-[#1A1814] bg-[#0F0F0D] text-[#E8E4D9] text-sm"
                    />
                    <div className="mt-3 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={handlePostComment}
                        className="px-4 py-2 rounded border border-[#D97706]/40 bg-[#0A0A08] text-[#E8E4D9] hover:border-[#D97706]/70 hover:shadow-[0_0_0_1px_rgba(217,119,6,0.25)] transition-all text-xs tracking-[0.2em] uppercase"
                        style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                      >
                        Post
                      </button>
                    </div>
                  </div>

                  <div className="mt-6">
                    {threadLoading ? (
                      <div className="text-[#A29A8C]">Loading thread…</div>
                    ) : threadMessages.length === 0 ? (
                      <div className="text-[#A29A8C]">No comments yet.</div>
                    ) : (
                      <div className="space-y-5">
                        {messageTree.map((node) => (
                          <CommentNode
                            key={node.id}
                            node={node}
                            onReply={(m) => {
                              setReplyTo(m);
                              setCommentText("");
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
