// src/pages/problemdetail.jsx - Problem Detail + Code Editor Page
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import AppHeader from "../components/layout/AppHeader";
import ProblemDescription from "../components/problem/ProblemDescription";
import CodeEditor from "../components/editor/CodeEditor";
import OutputPanel from "../components/editor/OutputPanel";
import AIFeedbackPanelV2 from "../components/feedback/AIFeedbackPanelV2";
import {
  getPublicQuestion,
  runQuestion,
  submitQuestion,
} from "../services/api";
import { useAIFeedback, checkAIHealth } from "../hooks/useAIFeedback";

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
  const [aiServiceAvailable, setAiServiceAvailable] = useState(null);
  const abortControllerRef = useRef(null);

  const [lastSubmission, setLastSubmission] = useState(null);

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

      examples: Array.isArray(problemRaw.examples)
        ? problemRaw.examples
        : [],
      testCases: Array.isArray(problemRaw.testCases)
        ? problemRaw.testCases
        : [],
    };
  }, [problemRaw]);

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

      setOutput(
        JSON.stringify(data, null, 2)
      );

      const isAccepted = isSubmit
        ? data.status === "accepted"
        : !!data.allPassed;

      setStatus(isAccepted ? "success" : "error");

      if (isSubmit) {
        const submissionData = {
          questionId: id,
          code,
          language: langKey,
          verdict: data.status || (isAccepted ? "accepted" : "wrong_answer"),
          errorType: data.errorType || null,
        };

        setLastSubmission(submissionData);
        setSubmitted(true);
        triggerAIFeedback(submissionData);
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

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A08" }}>
      <AppHeader />

      <main className="pt-14 h-screen flex flex-col">
        <div className="flex-1 flex overflow-hidden">
          <motion.div className="w-1/2 border-r border-[#1A1814] overflow-auto">
            {loadingProblem ? (
              <div className="p-6">Loading problem...</div>
            ) : problemError ? (
              <div className="p-6">{problemError}</div>
            ) : (
              <ProblemDescription problem={problem} />
            )}
          </motion.div>

          <div className="w-1/2 flex flex-col">
            <CodeEditor onRun={handleRun} onSubmit={handleSubmit} />
            <OutputPanel output={output} status={status} />
          </div>
        </div>
      </main>
    </div>
  );
}
