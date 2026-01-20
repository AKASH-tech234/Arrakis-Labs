// src/pages/problemdetail.jsx - Problem Detail + Code Editor Page
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import AppHeader from "../components/layout/AppHeader";
import ProblemDescription from "../components/problem/ProblemDescription";
import CodeEditor from "../components/editor/CodeEditor";
import OutputPanel from "../components/editor/OutputPanel";
import AIFeedbackPanel from "../components/feedback/AIFeedbackPanel";
import {
  getPublicQuestion,
  runQuestion,
  submitQuestion,
} from "../services/api";
import { useAIFeedback } from "../hooks/useAIFeedback";

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
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState("idle");
  const [submitted, setSubmitted] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const abortControllerRef = useRef(null);

  // Track last submission details for AI feedback
  const [lastSubmission, setLastSubmission] = useState(null);

  // AI Feedback hook
  const {
    feedback,
    loading: feedbackLoading,
    error: feedbackError,
    fetchFeedback,
    reset: resetFeedback,
  } = useAIFeedback();

  const [loadingProblem, setLoadingProblem] = useState(true);
  const [problemError, setProblemError] = useState("");
  const [problemRaw, setProblemRaw] = useState(null);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

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
      controller.abort();
    };
  }, [id]);

  const problem = useMemo(() => {
    if (!problemRaw) return defaultProblem;

    const category =
      Array.isArray(problemRaw.tags) && problemRaw.tags.length > 0
        ? problemRaw.tags[0]
        : "General";
    const constraints =
      typeof problemRaw.constraints === "string"
        ? problemRaw.constraints
            .split(/\r?\n/)
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

    return {
      id: problemRaw._id,
      externalId: problemRaw.externalId,
      title: problemRaw.title,
      difficulty: problemRaw.difficulty,
      category,
      description: problemRaw.description,
      constraints,
      examples: Array.isArray(problemRaw.examples) ? problemRaw.examples : [],
      testCases: Array.isArray(problemRaw.testCases)
        ? problemRaw.testCases
        : [],
    };
  }, [problemRaw]);

  /**
   * Format execution result for display
   */
  const formatJudgeOutput = ({
    headerText,
    statusLabel,
    passedCount,
    totalCount,
    results,
  }) => {
    const lines = [headerText];

    if (statusLabel) lines.push(`Status: ${statusLabel}`);
    if (typeof passedCount === "number" && typeof totalCount === "number") {
      lines.push(`Passed: ${passedCount}/${totalCount}`);
    }

    lines.push("\n=== RESULTS ===");
    (results || []).forEach((r, idx) => {
      const label = r.label || `Test ${idx + 1}`;
      const badge = r.passed ? "PASS" : "FAIL";
      const hiddenSuffix = r.isHidden ? " (hidden)" : "";

      lines.push(`\n[${badge}] ${label}${hiddenSuffix}`);
      if (!r.isHidden) {
        if (r.stdin !== undefined) lines.push(`stdin: ${String(r.stdin)}`);
        if (r.expectedStdout !== undefined)
          lines.push(`expected: ${String(r.expectedStdout)}`);
        if (r.actualStdout !== undefined)
          lines.push(`actual: ${String(r.actualStdout)}`);
        if (r.stderr) lines.push(`stderr: ${String(r.stderr)}`);
      }

      if (r.compileError) lines.push("compile_error: true");
      if (r.timedOut) lines.push("timed_out: true");
    });

    return lines.join("\n");
  };

  /**
   * Execute code via Piston API
   */
  const runOrSubmit = async (code, language, isSubmit = false) => {
    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Validate input
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

      const headerText = isSubmit
        ? `Submitted ${language} solution`
        : `Running ${language} solution`;

      const statusLabel = isSubmit ? data.status : undefined;
      setOutput(
        formatJudgeOutput({
          headerText,
          statusLabel,
          passedCount: data.passedCount,
          totalCount: data.totalCount,
          results: data.results,
        }),
      );

      const isAccepted = isSubmit
        ? data.status === "accepted"
        : !!data.allPassed;
      setStatus(isAccepted ? "success" : "error");

      // Track submission details for AI feedback (only for failed submissions)
      if (isSubmit && !isAccepted) {
        setLastSubmission({
          questionId: id,
          code,
          language: langKey,
          verdict: data.status || "wrong_answer",
          errorType: data.errorType || null,
        });
        setSubmitted(true);
      } else if (isSubmit && isAccepted) {
        setSubmitted(true);
        setLastSubmission(null);
      }
    } catch (err) {
      if (err.name === "AbortError") {
        // Request was cancelled, keep previous output or show cancelled
        setOutput((prev) => prev || "Cancelled.");
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

  const handleRun = (code, language) => {
    runOrSubmit(code, language, false);
  };

  const handleSubmit = (code, language) => {
    runOrSubmit(code, language, true);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A08" }}>
      <AppHeader />

      <main className="pt-14 h-screen flex flex-col">
        {/* Breadcrumb */}
        <div className="border-b border-[#1A1814] px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center gap-2">
            <Link
              to="/problems"
              className="text-[#78716C] hover:text-[#E8E4D9] text-xs uppercase tracking-wider transition-colors"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Problems
            </Link>
            <span className="text-[#3D3D3D]">/</span>
            <span
              className="text-[#E8E4D9] text-xs uppercase tracking-wider"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {loadingProblem ? "Loading..." : problem.title}
            </span>
          </div>
        </div>

        {/* Main Content - Split View */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Problem Description */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="w-1/2 border-r border-[#1A1814] overflow-auto"
          >
            {loadingProblem ? (
              <div className="p-6">
                <p
                  className="text-[#78716C] text-sm uppercase tracking-wider"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  Loading problem...
                </p>
              </div>
            ) : problemError ? (
              <div className="p-6">
                <p
                  className="text-[#92400E] text-sm uppercase tracking-wider"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  {problemError}
                </p>
              </div>
            ) : (
              <ProblemDescription problem={problem} />
            )}
          </motion.div>

          {/* Right Panel - Editor + Output + Feedback */}
          <div className="w-1/2 flex">
            {/* Editor Section */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className={`flex flex-col ${showFeedback ? "w-1/2" : "w-full"}`}
            >
              {/* Code Editor */}
              <div className="flex-1">
                <CodeEditor onRun={handleRun} onSubmit={handleSubmit} />
              </div>

              {/* Output Panel */}
              <OutputPanel output={output} status={status} />

              {/* Get AI Feedback Button - Shows only for failed submissions */}
              {submitted && lastSubmission && !showFeedback && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="border-t border-[#1A1814] px-4 py-3"
                >
                  <button
                    onClick={() => {
                      setShowFeedback(true);
                      fetchFeedback(lastSubmission);
                    }}
                    className="w-full py-2 border border-[#92400E]/30 text-[#D97706] hover:bg-[#92400E]/10 transition-colors duration-200 text-xs uppercase tracking-wider"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    Get AI Feedback
                  </button>
                </motion.div>
              )}

              {/* Success Message for Accepted Submissions */}
              {submitted && !lastSubmission && !showFeedback && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="border-t border-[#1A1814] px-4 py-3"
                >
                  <div className="flex items-center justify-center gap-2 py-2 border border-[#22C55E]/30 bg-[#22C55E]/5">
                    <span className="text-[#22C55E]">✓</span>
                    <span
                      className="text-[#22C55E] text-xs uppercase tracking-wider"
                      style={{
                        fontFamily: "'Rajdhani', system-ui, sans-serif",
                      }}
                    >
                      Solution Accepted
                    </span>
                  </div>
                </motion.div>
              )}
            </motion.div>

            {/* AI Feedback Panel */}
            {showFeedback && (
              <div className="w-1/2">
                <AIFeedbackPanel
                  isVisible={showFeedback}
                  onClose={() => {
                    setShowFeedback(false);
                    resetFeedback();
                  }}
                  loading={feedbackLoading}
                  error={feedbackError}
                  feedback={feedback}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
