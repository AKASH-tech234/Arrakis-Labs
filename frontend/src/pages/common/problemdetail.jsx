// src/pages/problemdetail.jsx - Problem Detail + Code Editor Page
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import AppHeader from "../../components/layout/AppHeader";
import ProblemDescription from "../../components/problem/ProblemDescription";
import ProblemSubmissionsPanel from "../../components/problem/ProblemSubmissionsPanel";
import SolutionDiscussion from "../../components/discuss/SolutionDiscussion";
import CodeEditor from "../../components/editor/CodeEditor";
import OutputPanel from "../../components/editor/OutputPanel";
import AIFeedbackPanelV2 from "../../components/feedback/AIFeedbackPanelV2";
import { MessageSquare } from "lucide-react";
import DiscussDrawer from "../../components/discuss/DiscussDrawer";
import {
  getPublicQuestion,
  getMySubmissions,
  runQuestion,
  submitQuestion,
} from "../../services/common/api";
import { recordPOTDAttempt, solvePOTD } from "../../services/potd/potdApi";
import { useAIFeedback, checkAIHealth } from "../../hooks/ai/useAIFeedback";
import { useSubmission } from "../../context/SubmissionContext";

// Map UI language names to Piston runtime identifiers
const languageMap = {
  Python: "python",
  JavaScript: "javascript",
  Java: "java",
  "C++": "cpp",
};

const defaultProblem = {
  id: 0,
  title: "Problem Not Found",
  difficulty: "Easy",
  category: "Unknown",
  description: "This problem could not be found in the archive.",
  constraints: [],
  examples: [],
};

export default function ProblemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { recordSubmission } = useSubmission();

  const isPOTD = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("potd") === "true";
  }, [location.search]);

  const [output, setOutput] = useState("");
  const [status, setStatus] = useState("idle");
  const [submitted, setSubmitted] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [aiServiceAvailable, setAiServiceAvailable] = useState(null);
  const abortControllerRef = useRef(null);

  const [lastSubmission, setLastSubmission] = useState(null);
  const [lastAcceptedFromHistory, setLastAcceptedFromHistory] = useState(null);

  const [discussOpen, setDiscussOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("description");

  const {
    feedback,
    loading: feedbackLoading,
    error: feedbackError,
    fetchFeedback,
    reset: resetFeedback,
    revealNextHint,
    hasMoreHints,
    nextHintLabel,
    toggleExplanation,
    showFullExplanation,
  } = useAIFeedback();

  const [loadingProblem, setLoadingProblem] = useState(true);
  const [problemError, setProblemError] = useState("");
  const [problemRaw, setProblemRaw] = useState(null);

  useEffect(() => {
    checkAIHealth().then(setAiServiceAvailable);
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoadingProblem(true);
        setProblemError("");
        const q = await getPublicQuestion(id);
        if (mounted) setProblemRaw(q);
      } catch (e) {
        if (mounted) setProblemError(e?.message || "Failed to load problem");
      } finally {
        if (mounted) setLoadingProblem(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [id]);

  useEffect(() => {
    let mounted = true;

    const loadAccepted = async () => {
      try {
        const submissions = await getMySubmissions({ questionId: id });
        const accepted = Array.isArray(submissions)
          ? submissions.find((s) => String(s.status).toLowerCase() === "accepted")
          : null;

        if (!mounted) return;

        if (accepted?._id) {
          setLastAcceptedFromHistory({ submissionId: accepted._id });
        } else {
          setLastAcceptedFromHistory(null);
        }
      } catch {
        if (mounted) setLastAcceptedFromHistory(null);
      }
    };

    loadAccepted();
    return () => {
      mounted = false;
    };
  }, [id]);

  // ✅ FIXED: DO NOT REFORMAT CONSTRAINTS
  const problem = useMemo(() => {
    if (!problemRaw) return defaultProblem;

    const category =
      Array.isArray(problemRaw.tags) && problemRaw.tags.length > 0
        ? problemRaw.tags[0]
        : "General";

    return {
      id: problemRaw._id,
      externalId: problemRaw.externalId,
      title: problemRaw.title,
      difficulty: problemRaw.difficulty,
      category,
      description: problemRaw.description,

      // 🔥 LeetCode-style constraints (already formatted in API layer)
      constraints: Array.isArray(problemRaw.constraints)
        ? problemRaw.constraints
        : [],

      examples: Array.isArray(problemRaw.examples) ? problemRaw.examples : [],
      testCases: Array.isArray(problemRaw.testCases)
        ? problemRaw.testCases
        : [],
    };
  }, [problemRaw]);

  const lastAcceptedSubmission = useMemo(() => {
    const verdict = String(lastSubmission?.verdict || "").toLowerCase();
    if (verdict === "accepted" && lastSubmission?.backendSubmissionId) {
      return { submissionId: lastSubmission.backendSubmissionId };
    }
    return lastAcceptedFromHistory;
  }, [lastSubmission, lastAcceptedFromHistory]);

  const runOrSubmit = async (code, language, isSubmit = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (!code || !code.trim()) {
      setStatus("error");
      setOutput("No code to run.");
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStatus("running");
    setOutput(isSubmit ? "Submitting..." : "Running...");
    setSubmitted(false);
    setLastSubmission(null);
    resetFeedback();
    setShowFeedback(false);

    try {
      const langKey = (languageMap[language] || language).toLowerCase();
      const payload = {
        questionId: id,
        code,
        language: langKey,
        signal: controller.signal,
      };

      const data = isSubmit
        ? await submitQuestion(payload)
        : await runQuestion(payload);

      setOutput(JSON.stringify(data, null, 2));

      const isAccepted = isSubmit
        ? data.status === "accepted"
        : !!data.allPassed;

      setStatus(isAccepted ? "success" : "error");

      if (isSubmit) {
        // Best-effort POTD tracking (UTC day semantics enforced server-side).
        // We avoid sending potdId unless we have it; undefined is omitted by JSON.
        if (isPOTD && data?.submissionId) {
          try {
            await recordPOTDAttempt(undefined, data.submissionId);
          } catch {
            // ignore
          }

          if (data.status === "accepted") {
            try {
              await solvePOTD(undefined, data.submissionId);
            } catch {
              // ignore
            }
          }
        }

        const submissionData = {
          questionId: id,
          questionTitle: problem.title,
          code,
          language: langKey,
          verdict: data.status || (isAccepted ? "accepted" : "wrong_answer"),
          errorType: data.errorType || null,
          runtime: data.runtime || null,
          memory: data.memory || null,
          backendSubmissionId: data.submissionId || null,
        };

        // Record submission in context (DOES NOT auto-trigger AI)
        const submission = recordSubmission(submissionData);

        setLastSubmission(submissionData);
        setSubmitted(true);

        // Navigate to results page where user can EXPLICITLY request AI feedback
        navigate(`/submissions/${submission.id}`);
      }
    } catch (err) {
      if (err.name === "AbortError") {
        setStatus("idle");
      } else {
        setOutput(`Error: ${err.message}`);
        setStatus("error");
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  const handleRun = (code, language) => runOrSubmit(code, language, false);
  const handleSubmit = (code, language) => runOrSubmit(code, language, true);

  // Resizable panel state
  const [panelWidth, setPanelWidth] = useState(50); // percentage
  const [isDragging, setIsDragging] = useState(false);
  const [isEditorFullscreen, setIsEditorFullscreen] = useState(false);
  const [previousWidth, setPreviousWidth] = useState(50);
  const containerRef = useRef(null);

  // Output panel vertical resize state
  const [outputHeight, setOutputHeight] = useState(180); // pixels
  const [isOutputDragging, setIsOutputDragging] = useState(false);
  const editorPanelRef = useRef(null);

  // Handle resize drag
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging || !containerRef.current) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const newWidth = ((e.clientX - rect.left) / rect.width) * 100;

      // Clamp between 20% and 80%
      const clampedWidth = Math.min(Math.max(newWidth, 20), 80);

      requestAnimationFrame(() => {
        setPanelWidth(clampedWidth);
      });
    },
    [isDragging],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  // Attach mouse listeners for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Editor fullscreen controls
  const handleToggleFullscreen = useCallback(() => {
    if (!isEditorFullscreen) {
      setPreviousWidth(panelWidth);
      setPanelWidth(0);
    } else {
      setPanelWidth(previousWidth);
    }
    setIsEditorFullscreen(!isEditorFullscreen);
  }, [isEditorFullscreen, panelWidth, previousWidth]);

  const handleRestoreEditor = useCallback(() => {
    setPanelWidth(previousWidth || 50);
    setIsEditorFullscreen(false);
  }, [previousWidth]);

  // Keyboard shortcut: Esc to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isEditorFullscreen) {
        handleRestoreEditor();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditorFullscreen, handleRestoreEditor]);

  // Output panel vertical resize handlers
  const handleOutputResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsOutputDragging(true);
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  }, []);

  const handleOutputResizeMove = useCallback(
    (e) => {
      if (!isOutputDragging || !editorPanelRef.current) return;

      const panel = editorPanelRef.current;
      const rect = panel.getBoundingClientRect();
      const newHeight = rect.bottom - e.clientY;

      // Clamp between 100px and 400px
      const clampedHeight = Math.min(Math.max(newHeight, 100), 400);

      requestAnimationFrame(() => {
        setOutputHeight(clampedHeight);
      });
    },
    [isOutputDragging],
  );

  const handleOutputResizeEnd = useCallback(() => {
    setIsOutputDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  // Attach mouse listeners for output panel dragging
  useEffect(() => {
    if (isOutputDragging) {
      window.addEventListener("mousemove", handleOutputResizeMove);
      window.addEventListener("mouseup", handleOutputResizeEnd);
    }
    return () => {
      window.removeEventListener("mousemove", handleOutputResizeMove);
      window.removeEventListener("mouseup", handleOutputResizeEnd);
    };
  }, [isOutputDragging, handleOutputResizeMove, handleOutputResizeEnd]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A08" }}>
      <AppHeader />

      <main className="pt-14 h-screen flex flex-col">
        <div
          ref={containerRef}
          className="flex-1 flex overflow-hidden relative"
        >
          <div className="absolute bottom-6 right-6 z-[70]">
            <button
              type="button"
              onClick={() => {
                if (panelWidth < 5) {
                  setDiscussOpen(true);
                } else {
                  setActiveTab("discuss");
                }
              }}
              className="group inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-[#2A2A24] bg-[#0A0A08] text-[#E8E4D9] hover:border-[#D97706]/60 hover:shadow-[0_0_0_1px_rgba(217,119,6,0.18)] transition-all"
            >
              <MessageSquare className="w-4 h-4 text-[#F59E0B] group-hover:text-[#FBBF24] transition-colors" />
              <span
                className="text-xs tracking-[0.25em] uppercase"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Discuss
              </span>
            </button>
          </div>

          {/* Problem Panel */}
          <div
            className="overflow-auto bg-[#0A0A08] transition-all duration-200 ease-out"
            style={{
              width: `${panelWidth}%`,
              minWidth: panelWidth > 0 ? "200px" : "0",
              opacity: panelWidth < 5 ? 0 : 1,
              visibility: panelWidth < 5 ? "hidden" : "visible",
            }}
          >
            {loadingProblem ? (
              <div className="p-6 text-[#78716C]">Loading problem...</div>
            ) : problemError ? (
              <div className="p-6 text-[#92400E]">{problemError}</div>
            ) : (
              <div className="h-full flex flex-col">
                <div className="sticky top-0 z-10 bg-[#0A0A08] border-b border-[#1A1814]">
                  <div className="px-6 pt-4 pb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {[
                        { key: "description", label: "Description" },
                        { key: "submissions", label: "Submissions" },
                        { key: "discuss", label: "Discuss" },
                      ].map((t) => (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => {
                            setActiveTab(t.key);
                            if (t.key === "discuss" && panelWidth < 5) setDiscussOpen(true);
                          }}
                          className={`px-3 py-2 rounded-lg border text-xs tracking-[0.25em] uppercase transition-all ${
                            activeTab === t.key
                              ? "border-[#D97706]/50 bg-[#0F0F0D] text-[#E8E4D9]"
                              : "border-[#1A1814] bg-[#0A0A08] text-[#A29A8C] hover:border-[#D97706]/30"
                          }`}
                          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-h-0">
                  {activeTab === "description" ? (
                    <ProblemDescription problem={problem} />
                  ) : activeTab === "submissions" ? (
                    <ProblemSubmissionsPanel
                      questionId={id}
                      onAccepted={(a) => setLastAcceptedFromHistory(a)}
                    />
                  ) : (
                    <SolutionDiscussion
                      problemId={problem?.id || problem?._id}
                      lastAcceptedSubmission={lastAcceptedSubmission}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Resizable Divider */}
          <div
            onMouseDown={handleMouseDown}
            className={`arrakis-divider w-1 cursor-col-resize flex-shrink-0 relative group transition-colors duration-150 ${
              isDragging ? "bg-[#F59E0B]" : "bg-[#1A1814] hover:bg-[#92400E]/50"
            }`}
            style={{
              display: panelWidth < 5 || panelWidth > 95 ? "none" : "block",
            }}
          >
            {/* Drag handle indicator */}
            <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-[#F59E0B]/10" />
          </div>

          {/* Editor Panel */}
          <div
            ref={editorPanelRef}
            className="flex flex-col overflow-hidden bg-[#0A0A08] transition-all duration-200 ease-out"
            style={{
              width: `${100 - panelWidth}%`,
              flexGrow: isEditorFullscreen ? 1 : 0,
            }}
          >
            <div className="flex-1 overflow-hidden">
              <CodeEditor
                onRun={handleRun}
                onSubmit={handleSubmit}
                isFullscreen={isEditorFullscreen}
                onToggleFullscreen={handleToggleFullscreen}
                onRestore={handleRestoreEditor}
              />
            </div>
            <OutputPanel
              output={output}
              status={status}
              height={outputHeight}
              onResizeStart={handleOutputResizeStart}
            />
          </div>
        </div>

        <DiscussDrawer
          open={discussOpen}
          onClose={() => setDiscussOpen(false)}
          problem={problem}
          lastAcceptedSubmission={lastAcceptedSubmission}
        />
      </main>
    </div>
  );
}
