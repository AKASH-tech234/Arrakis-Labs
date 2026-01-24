// src/pages/problemdetail.jsx - Problem Detail + Code Editor Page
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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

// Format output in LeetCode style (plain text, not JSON)
const formatLeetCodeOutput = (data, isSubmit) => {
  // Handle compile errors
  if (data.status === "compile_error" || data.compileError || data.error?.includes("compile")) {
    const errorMsg = data.compileError || data.error || data.message || "Compilation failed";
    // Parse line/char info if available
    const lineMatch = errorMsg.match(/line\s*(\d+)/i);
    const charMatch = errorMsg.match(/(?:char|column|col)\s*(\d+)/i);
    
    let output = "Compile Error\n";
    if (lineMatch || charMatch) {
      output += `Line ${lineMatch?.[1] || "?"}: Char ${charMatch?.[1] || "?"}: `;
    }
    output += `error: ${errorMsg.replace(/^.*error:\s*/i, "")}`;
    return output;
  }

  // Handle runtime errors
  if (data.status === "runtime_error" || data.runtimeError) {
    const errorMsg = data.runtimeError || data.error || data.message || "Runtime error occurred";
    return `Runtime Error\n\n${errorMsg}`;
  }

  // Handle time limit exceeded
  if (data.status === "time_limit_exceeded" || data.timeout) {
    return "Time Limit Exceeded\n\nYour code took too long to execute.";
  }

  // Handle wrong answer
  if (data.status === "wrong_answer" || (data.results && !data.allPassed)) {
    let output = "Wrong Answer\n\n";
    
    if (data.results && Array.isArray(data.results)) {
      const failedTest = data.results.find(r => !r.passed);
      if (failedTest) {
        if (failedTest.input !== undefined) {
          output += `Input:\n${failedTest.input}\n\n`;
        }
        output += `Expected Output:\n${failedTest.expected || failedTest.expectedOutput || "N/A"}\n\n`;
        output += `Actual Output:\n${failedTest.actual || failedTest.output || failedTest.stdout || "N/A"}`;
      }
    } else if (data.expected !== undefined || data.actual !== undefined) {
      output += `Expected Output:\n${data.expected || "N/A"}\n\n`;
      output += `Actual Output:\n${data.actual || data.output || "N/A"}`;
    }
    
    return output;
  }

  // Handle accepted
  if (data.status === "accepted" || data.allPassed) {
    let output = "Accepted\n\n";
    
    if (data.results && Array.isArray(data.results)) {
      const passedCount = data.results.filter(r => r.passed).length;
      output += `${passedCount}/${data.results.length} test cases passed\n\n`;
      
      // Show runtime if available
      if (data.runtime || data.executionTime) {
        output += `Runtime: ${data.runtime || data.executionTime} ms\n`;
      }
      if (data.memory) {
        output += `Memory: ${data.memory} MB`;
      }
    } else {
      output += "All test cases passed!";
    }
    
    return output;
  }

  // Handle successful run (not submit) - just show stdout
  if (data.output !== undefined || data.stdout !== undefined) {
    const stdout = data.output || data.stdout || "";
    
    if (data.results && Array.isArray(data.results)) {
      let output = "";
      const passedCount = data.results.filter(r => r.passed).length;
      const totalCount = data.results.length;
      
      if (passedCount === totalCount) {
        output += `✓ ${passedCount}/${totalCount} test cases passed\n\n`;
      } else {
        output += `✗ ${passedCount}/${totalCount} test cases passed\n\n`;
      }
      
      // Show first test case output
      if (data.results[0]) {
        const first = data.results[0];
        if (first.input !== undefined) {
          output += `Input:\n${first.input}\n\n`;
        }
        output += `Output:\n${first.output || first.stdout || first.actual || ""}`;
        
        if (!first.passed && first.expected) {
          output += `\n\nExpected:\n${first.expected}`;
        }
      }
      
      return output;
    }
    
    return stdout || "(No output)";
  }

  // Fallback - show raw data in readable format
  if (data.message) {
    return data.message;
  }
  
  return "Code executed successfully.";
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
  const [runResults, setRunResults] = useState(null); // Store raw results for Result tab

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
    setRunResults(null);
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

      // Store raw results for Result tab
      setRunResults(data);

      // Format output in LeetCode style (plain text, not JSON)
      const formattedOutput = formatLeetCodeOutput(data, isSubmit);
      setOutput(formattedOutput);

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

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !containerRef.current) return;
    
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
    
    // Clamp between 20% and 80%
    const clampedWidth = Math.min(Math.max(newWidth, 20), 80);
    
    requestAnimationFrame(() => {
      setPanelWidth(clampedWidth);
    });
  }, [isDragging]);

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

  const handleOutputResizeMove = useCallback((e) => {
    if (!isOutputDragging || !editorPanelRef.current) return;
    
    const panel = editorPanelRef.current;
    const rect = panel.getBoundingClientRect();
    const newHeight = rect.bottom - e.clientY;
    
    // Clamp between 100px and 400px
    const clampedHeight = Math.min(Math.max(newHeight, 100), 400);
    
    requestAnimationFrame(() => {
      setOutputHeight(clampedHeight);
    });
  }, [isOutputDragging]);

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
              <ProblemDescription problem={problem} />
            )}
          </div>

          {/* Resizable Divider */}
          <div
            onMouseDown={handleMouseDown}
            className={`arrakis-divider w-1 cursor-col-resize flex-shrink-0 relative group transition-colors duration-150 ${
              isDragging ? "bg-[#F59E0B]" : "bg-[#1A1814] hover:bg-[#92400E]/50"
            }`}
            style={{ 
              display: panelWidth < 5 || panelWidth > 95 ? "none" : "block" 
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
              testCases={problem.examples}
              runResults={runResults}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
