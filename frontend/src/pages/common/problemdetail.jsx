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
          ? submissions.find(
              (s) => String(s.status).toLowerCase() === "accepted",
            )
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

  const problem = useMemo(() => {
    if (!problemRaw) return defaultProblem;

    const category = problemRaw.categoryType || "Unknown";

    return {
      id: problemRaw._id,
      externalId: problemRaw.externalId,
      title: problemRaw.title,
      difficulty: problemRaw.difficulty,
      category,
      description: problemRaw.description,

      inputFormat: problemRaw.inputFormat || null,
      outputFormat: problemRaw.outputFormat || null,

      constraints: Array.isArray(problemRaw.constraints)
        ? problemRaw.constraints
        : [],

      examples: Array.isArray(problemRaw.examples) ? problemRaw.examples : [],
      testCases: Array.isArray(problemRaw.testCases)
        ? problemRaw.testCases
        : [],

      // AI Metadata fields
      topic: problemRaw.topic || null,
      expectedApproach: problemRaw.expectedApproach || null,
      canonicalAlgorithms: problemRaw.canonicalAlgorithms || [],
      timeComplexityHint: problemRaw.timeComplexityHint || null,
      spaceComplexityHint: problemRaw.spaceComplexityHint || null,
      commonMistakes: problemRaw.commonMistakes || [],
    };
  }, [problemRaw]);

  const lastAcceptedSubmission = useMemo(() => {
    const verdict = String(lastSubmission?.verdict || "").toLowerCase();
    if (verdict === "accepted" && lastSubmission?.backendSubmissionId) {
      return { submissionId: lastSubmission.backendSubmissionId };
    }
    return lastAcceptedFromHistory;
  }, [lastSubmission, lastAcceptedFromHistory]);
  // Code validation constants
  const MIN_CODE_LENGTH = 10;
  const MAX_CODE_LENGTH = 65536; // 64KB

  const runOrSubmit = async (code, language, isSubmit = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Validate code is not empty
    if (!code || !code.trim()) {
      setStatus("error");
      setOutput("⚠️ No code to run. Please write your solution first.");
      return;
    }

    // Validate minimum code length (prevents empty/placeholder submissions)
    const trimmedCode = code.trim();
    if (trimmedCode.length < MIN_CODE_LENGTH) {
      setStatus("error");
      setOutput(
        `⚠️ Code is too short (${trimmedCode.length} chars). Please write a meaningful solution with at least ${MIN_CODE_LENGTH} characters.`,
      );
      return;
    }

    // Validate maximum code length
    if (code.length > MAX_CODE_LENGTH) {
      setStatus("error");
      setOutput(
        `⚠️ Code exceeds maximum size (${Math.round(code.length / 1024)}KB). Maximum allowed is 64KB.`,
      );
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

      // Format output for LeetCode-style display in OutputPanel
      // The OutputPanel expects a specific structure with results array
      const formattedOutput = {
        status: isSubmit ? data.status : (data.allPassed ? "accepted" : "wrong_answer"),
        results: data.results || [],
        passedCount: data.passedCount || 0,
        totalCount: data.totalCount || 0,
        allPassed: data.allPassed || false,
        // For submit: include first failing index for easy navigation
        firstFailingIndex: data.firstFailingIndex ?? -1,
        // Include AI feedback for submit results
        aiFeedback: isSubmit ? data.aiFeedback : null,
        // Include submission ID for linking
        submissionId: data.submissionId || null,
      };

      setOutput(formattedOutput);

      const isAccepted = isSubmit
        ? data.status === "accepted"
        : !!data.allPassed;

      setStatus(isAccepted ? "success" : "error");

      if (isSubmit) {
        if (isPOTD && data?.submissionId) {
          try {
            await recordPOTDAttempt(undefined, data.submissionId);
          } catch {}

          if (data.status === "accepted") {
            try {
              await solvePOTD(undefined, data.submissionId);
            } catch {}
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
          // Pass test case results for display in result panel
          results: data.results || [],
          passedCount: data.passedCount || 0,
          totalCount: data.totalCount || 0,
          firstFailingIndex: data.firstFailingIndex ?? -1,
          // ✨ FIX: Pass aiFeedback from backend response to avoid duplicate API calls
          aiFeedback: data.aiFeedback || null,
          backendSubmissionId: data.submissionId || null,
        };

        // Record submission in context (includes aiFeedback if present)
        const submission = recordSubmission(submissionData);

        setLastSubmission(submissionData);
        setSubmitted(true);

        // ✨ FIX: ALWAYS open submission result panel after Submit
        // Panel visibility must NOT be conditional on verdict
        // The panel should open for: Accepted, Wrong Answer, TLE, Runtime Error, etc.
        setShowFeedback(true);

        // Fetch AI feedback if not already included and service is available
        if (!data.aiFeedback && aiServiceAvailable && !isAccepted) {
          fetchFeedback({
            questionId: id,
            code,
            language: langKey,
            verdict: data.status || "wrong_answer",
            errorType: data.errorType,
          });
        }
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

  const [panelWidth, setPanelWidth] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [isEditorFullscreen, setIsEditorFullscreen] = useState(false);
  const [previousWidth, setPreviousWidth] = useState(50);
  const containerRef = useRef(null);

  const [outputHeight, setOutputHeight] = useState(180);
  const [isOutputDragging, setIsOutputDragging] = useState(false);
  const editorPanelRef = useRef(null);

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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isEditorFullscreen) {
        handleRestoreEditor();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditorFullscreen, handleRestoreEditor]);

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

          {}
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
                            if (t.key === "discuss" && panelWidth < 5)
                              setDiscussOpen(true);
                          }}
                          className={`px-3 py-2 rounded-lg border text-xs tracking-[0.25em] uppercase transition-all ${
                            activeTab === t.key
                              ? "border-[#D97706]/50 bg-[#0F0F0D] text-[#E8E4D9]"
                              : "border-[#1A1814] bg-[#0A0A08] text-[#A29A8C] hover:border-[#D97706]/30"
                          }`}
                          style={{
                            fontFamily: "'Rajdhani', system-ui, sans-serif",
                          }}
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

          {}
          <div
            onMouseDown={handleMouseDown}
            className={`arrakis-divider w-1 cursor-col-resize flex-shrink-0 relative group transition-colors duration-150 ${
              isDragging ? "bg-[#F59E0B]" : "bg-[#1A1814] hover:bg-[#92400E]/50"
            }`}
            style={{
              display: panelWidth < 5 || panelWidth > 95 ? "none" : "block",
            }}
          >
            {}
            <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-[#F59E0B]/10" />
          </div>

          {}
          <div
            ref={editorPanelRef}
            className="flex flex-col overflow-hidden bg-[#0A0A08] transition-all duration-200 ease-out"
            style={{
              width: showFeedback
                ? `${(100 - panelWidth) * 0.6}%`
                : `${100 - panelWidth}%`,
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

          {/* ✨ AI Feedback Side Panel - Shows hints progressively */}
          {showFeedback && (
            <div
              className="flex-shrink-0 transition-all duration-300 ease-out"
              style={{
                width: `${(100 - panelWidth) * 0.4}%`,
                minWidth: "320px",
                maxWidth: "450px",
              }}
            >
              <AIFeedbackPanelV2
                isVisible={showFeedback}
                onClose={() => {
                  setShowFeedback(false);
                  // Navigate to full results when panel is closed
                  if (lastSubmission) {
                    navigate(`/submissions/${lastSubmission.questionId}`);
                  }
                }}
                loading={feedbackLoading}
                error={feedbackError}
                // ✨ FIX: Pass submission data so panel can show results even without AI feedback
                submissionData={lastSubmission}
                feedback={
                  feedback ||
                  (lastSubmission?.aiFeedback
                    ? {
                        success: true,
                        verdict: lastSubmission.verdict,
                        feedbackType:
                          lastSubmission.verdict === "accepted"
                            ? "success_feedback"
                            : "error_feedback",
                        hints: lastSubmission.aiFeedback.hints || [],
                        allHintsCount:
                          lastSubmission.aiFeedback.hints?.length || 0,
                        explanation: lastSubmission.aiFeedback.explanation,
                        hasExplanation: !!lastSubmission.aiFeedback.explanation,
                        detectedPattern:
                          lastSubmission.aiFeedback.detectedPattern,
                        mimInsights:
                          lastSubmission.aiFeedback.mimInsights ||
                          lastSubmission.aiFeedback.mim_insights,
                      }
                    : null)
                }
                onRevealNextHint={revealNextHint}
                hasMoreHints={hasMoreHints}
                nextHintLabel={nextHintLabel}
                onToggleExplanation={toggleExplanation}
                showFullExplanation={showFullExplanation}
                onRetry={() => {
                  if (lastSubmission) {
                    fetchFeedback({
                      questionId: lastSubmission.questionId,
                      code: lastSubmission.code,
                      language: lastSubmission.language,
                      verdict: lastSubmission.verdict,
                      errorType: lastSubmission.errorType,
                    });
                  }
                }}
              />
            </div>
          )}
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
