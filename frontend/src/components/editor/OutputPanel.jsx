import { useState, useMemo, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, Check, X, Clock, AlertTriangle } from "lucide-react";

const TabButton = ({ active, onClick, children, badge }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 text-[10px] uppercase tracking-wider transition-colors duration-150 border-b-2 flex items-center gap-2 ${
      active
        ? "text-[#F59E0B] border-[#F59E0B]"
        : "text-[#78716C] border-transparent hover:text-[#E8E4D9]"
    }`}
    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
  >
    {children}
    {badge !== undefined && (
      <span className={`text-[9px] px-1.5 py-0.5 rounded ${active ? "bg-[#F59E0B]/20" : "bg-[#1A1814]"}`}>
        {badge}
      </span>
    )}
  </button>
);


const formatTestCaseValue = (value) => {
  // If it's a string that looks like JSON, parse it
  if (typeof value === "string") {
    const trimmed = value.trim();
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || 
        (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        const parsed = JSON.parse(trimmed);
        return formatTestCaseObject(parsed);
      } catch (e) {
        return value;
      }
    }
    return value;
  }

  // If it's an object, format it
  if (typeof value === "object" && value !== null) {
    return formatTestCaseObject(value);
  }

  return String(value);
};

const formatTestCaseObject = (obj) => {
  if (Array.isArray(obj)) {
    return `[${obj.join(", ")}]`;
  }

  if (typeof obj === "object" && obj !== null) {
    return Object.entries(obj)
      .map(([key, val]) => {
        if (Array.isArray(val)) {
          return `${key} = [${val.join(", ")}]`;
        }
        if (typeof val === "object" && val !== null) {
          return `${key} = ${JSON.stringify(val)}`;
        }
        return `${key} = ${val}`;
      })
      .join("\n");
  }

  return String(obj);
};

export default function OutputPanel({ output, status, height, onResizeStart, testCases = [], runResults }) {
  const [activeTab, setActiveTab] = useState("testcase");
  const [selectedTestCase, setSelectedTestCase] = useState(0);
// Format input for display (handle arrays, objects, primitives)
function formatInputDisplay(stdin) {
  if (!stdin) return "";
  
  const lines = stdin.split("\n").filter(Boolean);
  const formatted = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        formatted.push(`[${parsed.join(",")}]`);
      } else if (typeof parsed === "object" && parsed !== null) {
        formatted.push(JSON.stringify(parsed));
      } else {
        formatted.push(String(parsed));
      }
    } catch {
      formatted.push(trimmed);
    }
  }
  
  return formatted.join("\n");
}

// Format output for display
function formatOutputDisplay(output) {
  if (!output) return "";
  return String(output).trim();
}

// Parse test results from output
function parseTestResults(output) {
  if (!output) return null;
  
  try {
    const data = typeof output === "string" ? JSON.parse(output) : output;
    
    if (data.results && Array.isArray(data.results)) {
      // Determine the actual status based on results
      let status = data.status;
      if (!status) {
        if (data.allPassed) {
          status = "accepted";
        } else {
          // Check specific error types
          const hasCompileError = data.results.some(r => r.compileError);
          const hasRuntimeError = data.results.some(r => r.runtimeError);
          const hasTLE = data.results.some(r => r.timedOut);
          
          if (hasCompileError) status = "compile_error";
          else if (hasTLE) status = "time_limit_exceeded";
          else if (hasRuntimeError) status = "runtime_error";
          else status = "wrong_answer";
        }
      }
      
      return {
        isSubmit: data.status !== undefined,
        status,
        results: data.results,
        passedCount: data.passedCount || 0,
        totalCount: data.totalCount || data.results.length,
        allPassed: data.allPassed || false,
        firstFailingIndex: data.firstFailingIndex ?? -1,
        submissionId: data.submissionId || null,
        aiFeedback: data.aiFeedback || null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// Status badge component
function StatusBadge({ passed, timedOut, compileError, runtimeError }) {
  if (compileError) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider bg-purple-500/20 text-purple-400">
        <AlertTriangle className="w-3 h-3" />
        Compile Error
      </span>
    );
  }
  if (timedOut) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider bg-yellow-500/20 text-yellow-400">
        <Clock className="w-3 h-3" />
        Time Limit Exceeded
      </span>
    );
  }
  if (runtimeError) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider bg-red-500/20 text-red-400">
        <AlertTriangle className="w-3 h-3" />
        Runtime Error
      </span>
    );
  }
  if (passed) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider bg-green-500/20 text-green-400">
        <Check className="w-3 h-3" />
        Accepted
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider bg-red-500/20 text-red-400">
      <X className="w-3 h-3" />
      Wrong Answer
    </span>
  );
}

// LeetCode-style test case display
function TestCaseDisplay({ result, index, isSubmit }) {
  const { stdin, expectedStdout, actualStdout, passed, timedOut, compileError, runtimeError, stderr, isHidden } = result;
  
  // Check if we have actual data to display (backend now exposes hidden test case data on failure)
  const hasData = stdin !== undefined || expectedStdout !== undefined || actualStdout !== undefined;
  
  // Only show "hidden" message if we truly have no data
  if (isHidden && !hasData) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[#78716C] text-xs uppercase tracking-wider" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
            Test Case {index + 1} (Hidden)
          </span>
          <StatusBadge passed={passed} timedOut={timedOut} compileError={compileError} />
        </div>
        <p className="text-[#78716C] text-xs italic">Hidden test case - input/output not shown</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hidden test case indicator - LeetCode style */}
      {isHidden && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <span className="text-yellow-400 text-xs uppercase tracking-wider" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
            Test Case {index + 1} (Hidden)
          </span>
        </div>
      )}
      
      {/* Input */}
      <div>
        <div className="text-[#78716C] text-[10px] uppercase tracking-wider mb-2" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
          Input:
        </div>
        <div className="bg-[#1A1814] rounded-lg p-3">
          <pre className="text-[#E8E4D9] text-xs whitespace-pre-wrap" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
            {formatInputDisplay(stdin) || "No input"}
          </pre>
        </div>
      </div>

      {/* Your Output */}
      <div>
        <div className="text-[#78716C] text-[10px] uppercase tracking-wider mb-2" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
          Your Output:
        </div>
        <div className={`rounded-lg p-3 ${passed ? "bg-[#1A1814]" : "bg-red-500/5 border border-red-500/20"}`}>
          <pre className={`text-xs whitespace-pre-wrap ${passed ? "text-[#E8E4D9]" : "text-red-400"}`} style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
            {formatOutputDisplay(actualStdout) || "(empty)"}
          </pre>
        </div>
      </div>

      {/* Expected Output */}
      <div>
        <div className="text-[#78716C] text-[10px] uppercase tracking-wider mb-2" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
          Expected Output:
        </div>
        <div className="bg-[#1A1814] rounded-lg p-3">
          <pre className="text-[#22C55E] text-xs whitespace-pre-wrap" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
            {formatOutputDisplay(expectedStdout) || "(empty)"}
          </pre>
        </div>
      </div>

      {/* Status */}
      <div>
        <div className="text-[#78716C] text-[10px] uppercase tracking-wider mb-2" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
          Status:
        </div>
        <StatusBadge passed={passed} timedOut={timedOut} compileError={compileError} runtimeError={runtimeError} />
      </div>

      {/* Error Output */}
      {stderr && (
        <div>
          <div className="text-[#78716C] text-[10px] uppercase tracking-wider mb-2" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
            Error Output:
          </div>
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
            <pre className="text-red-400 text-xs whitespace-pre-wrap" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
              {stderr}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// Submit result summary - LeetCode-style
function SubmitResultSummary({ parsedData, onViewTestCase }) {
  const { status, passedCount, totalCount, results, allPassed, submissionId } = parsedData;
  
  const firstFailingIndex = results.findIndex(r => !r.passed);
  
  const statusConfig = {
    accepted: { color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30", label: "Accepted", icon: <Check className="w-6 h-6" /> },
    wrong_answer: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", label: "Wrong Answer", icon: <X className="w-6 h-6" /> },
    time_limit_exceeded: { color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", label: "Time Limit Exceeded", icon: <Clock className="w-6 h-6" /> },
    compile_error: { color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30", label: "Compile Error", icon: <AlertTriangle className="w-6 h-6" /> },
    runtime_error: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", label: "Runtime Error", icon: <AlertTriangle className="w-6 h-6" /> },
  };
  
  const config = statusConfig[status] || statusConfig.wrong_answer;
  
  return (
    <div className="space-y-4">
      {/* Main Status - LeetCode-style header */}
      <div className={`${config.bg} ${config.border} border rounded-lg p-5`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full ${config.bg} flex items-center justify-center ${config.color}`}>
            {config.icon}
          </div>
          <div className="flex-1">
            <div className={`text-xl font-bold ${config.color}`} style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
              {allPassed ? "✓ " : "✗ "}{config.label}
            </div>
            <div className="text-[#78716C] text-sm mt-1">
              {passedCount} / {totalCount} test cases passed
            </div>
          </div>
        </div>
        
        {/* LeetCode-style stats grid for Accepted submissions */}
        {allPassed && (
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-green-500/20">
            <div className="text-center">
              <div className="text-[#78716C] text-[10px] uppercase tracking-wider mb-1" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
                Runtime
              </div>
              <div className="text-[#E8E4D9] text-sm font-semibold">
                — ms
              </div>
            </div>
            <div className="text-center">
              <div className="text-[#78716C] text-[10px] uppercase tracking-wider mb-1" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
                Memory
              </div>
              <div className="text-[#E8E4D9] text-sm font-semibold">
                — MB
              </div>
            </div>
            <div className="text-center">
              <div className="text-[#78716C] text-[10px] uppercase tracking-wider mb-1" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
                Tests
              </div>
              <div className="text-green-400 text-sm font-semibold">
                {passedCount}/{totalCount}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* First Failing Test Case - only for wrong answers */}
      {firstFailingIndex >= 0 && (
        <div className="border border-red-500/20 rounded-lg overflow-hidden bg-red-500/5">
          <div className="flex items-center justify-between px-4 py-3 border-b border-red-500/20 bg-red-500/10">
            <span className="text-red-400 text-xs uppercase tracking-wider font-semibold" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
              ✗ Failed Test Case {firstFailingIndex + 1} of {totalCount}
              {results[firstFailingIndex]?.isHidden && " (Hidden)"}
            </span>
            <button
              onClick={() => onViewTestCase(firstFailingIndex)}
              className="text-[#F59E0B] text-xs hover:text-[#FBBF24] transition-colors"
            >
              View All Tests →
            </button>
          </div>
          
          <div className="p-4">
            <TestCaseDisplay result={results[firstFailingIndex]} index={firstFailingIndex} isSubmit={true} />
          </div>
        </div>
      )}
      
      {/* Test Case Grid */}
      <div className="border border-[#1A1814] rounded-lg p-4">
        <div className="text-[#78716C] text-xs uppercase tracking-wider mb-3" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
          All Test Cases
        </div>
        <div className="flex flex-wrap gap-2">
          {results.map((r, idx) => (
            <button
              key={idx}
              onClick={() => onViewTestCase(idx)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                r.passed 
                  ? "bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30" 
                  : "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
              }`}
            >
              {r.passed ? "✓" : "✗"} {idx + 1}{r.isHidden ? " (H)" : ""}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function OutputPanel({ output, status, height, onResizeStart }) {
  const [activeTab, setActiveTab] = useState("output");
  const [currentTestCase, setCurrentTestCase] = useState(0);

  const parsedData = useMemo(() => parseTestResults(output), [output]);
  
  const visibleResults = useMemo(() => {
    if (!parsedData?.results) return [];
    return parsedData.results.filter(r => !r.isHidden);
  }, [parsedData]);
  
  const displayResults = useMemo(() => {
    if (!parsedData?.results) return [];
    return parsedData.isSubmit ? parsedData.results : visibleResults;
  }, [parsedData, visibleResults]);

  // Reset to first failing when output changes
  useEffect(() => {
    if (parsedData && displayResults.length > 0) {
      const firstFailing = displayResults.findIndex(r => !r.passed);
      setCurrentTestCase(firstFailing >= 0 ? firstFailing : 0);
    }
  }, [output]); // eslint-disable-line react-hooks/exhaustive-deps
>>>>>>> e7ba24d8e34452adb0c73fa0335031c7afca5ce6

  const statusConfig = {
    idle: { color: "text-[#3D3D3D]", bg: "", label: "" },
    running: { color: "text-[#D97706]", bg: "bg-[#D97706]/10", label: "Running..." },
<<<<<<< HEAD
    success: { color: "text-[#4ade80]", bg: "bg-[#4ade80]/10", label: "Accepted" },
    error: { color: "text-[#f87171]", bg: "bg-[#f87171]/10", label: "Wrong Answer" },
=======
    success: { color: "text-[#22C55E]", bg: "bg-[#22C55E]/10", label: "Accepted" },
    error: { color: "text-[#EF4444]", bg: "bg-[#EF4444]/10", label: "Wrong Answer" },
>>>>>>> e7ba24d8e34452adb0c73fa0335031c7afca5ce6
  };

  const currentStatus = statusConfig[status] || statusConfig.idle;

<<<<<<< HEAD
  // Get results array from runResults
  const resultsArray = runResults?.results || [];
  const passedCount = resultsArray.filter(r => r.passed).length;
  const totalCount = resultsArray.length;

  const renderTestCaseTab = () => (
    <div className="h-full flex flex-col">
      {/* Test case selector */}
      {testCases.length > 0 && (
        <div className="flex items-center gap-2 pb-3 border-b border-[#1A1814] mb-3">
          {testCases.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedTestCase(idx)}
              className={`px-3 py-1 text-[10px] uppercase tracking-wider transition-colors duration-150 ${
                selectedTestCase === idx
                  ? "bg-[#1A1814] text-[#F59E0B]"
                  : "text-[#78716C] hover:text-[#E8E4D9]"
              }`}
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Case {idx + 1}
            </button>
          ))}
        </div>
      )}

      {/* Test case content */}
      {testCases.length > 0 && testCases[selectedTestCase] ? (
        <div className="space-y-3 overflow-auto flex-1">
          <div>
            <label className="text-[#78716C] text-[10px] uppercase tracking-wider block mb-1"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
              Input
            </label>
            <div className="bg-[#121210] border border-[#1A1814] p-3 rounded">
              <pre className="text-[#E8E4D9] text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {formatTestCaseValue(testCases[selectedTestCase].input)}
              </pre>
            </div>
          </div>
          <div>
            <label className="text-[#78716C] text-[10px] uppercase tracking-wider block mb-1"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
              Expected Output
            </label>
            <div className="bg-[#121210] border border-[#1A1814] p-3 rounded">
              <pre className="text-[#E8E4D9] text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {formatTestCaseValue(testCases[selectedTestCase].output || testCases[selectedTestCase].expected)}
              </pre>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-full">
          <p className="text-[#3D3D3D] text-[10px] uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
            No test cases available
          </p>
        </div>
      )}
    </div>
  );

  const renderResultTab = () => {
    if (!runResults) {
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-[#3D3D3D] text-[10px] uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
            Run code to see results
=======
  const handlePrevTestCase = useCallback(() => {
    setCurrentTestCase(prev => Math.max(0, prev - 1));
  }, []);

  const handleNextTestCase = useCallback(() => {
    setCurrentTestCase(prev => Math.min(displayResults.length - 1, prev + 1));
  }, [displayResults.length]);

  const handleViewTestCase = useCallback((index) => {
    setCurrentTestCase(index);
    setActiveTab("testcase");
  }, []);

  const renderContent = () => {
    if (status === "running") {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-[#D97706] border-t-transparent rounded-full animate-spin" />
            <span className="text-[#D97706] text-sm" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
              Executing code...
            </span>
          </div>
        </div>
      );
    }

    if (!output) {
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-[#3D3D3D] text-[10px] uppercase tracking-wider" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
            Run or submit to see output
>>>>>>> e7ba24d8e34452adb0c73fa0335031c7afca5ce6
          </p>
        </div>
      );
    }

<<<<<<< HEAD
    const isAccepted = runResults.status === "accepted" || runResults.allPassed;
    const isCompileError = runResults.status === "compile_error" || runResults.compileError;
    const isRuntimeError = runResults.status === "runtime_error" || runResults.runtimeError;

    return (
      <div className="h-full overflow-auto">
        {/* Status header */}
        <div className={`flex items-center gap-3 pb-3 border-b border-[#1A1814] mb-3 ${
          isAccepted ? "text-[#4ade80]" : "text-[#f87171]"
        }`}>
          <span className="text-lg font-bold" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
            {isAccepted ? "✓ Accepted" : 
             isCompileError ? "✗ Compile Error" :
             isRuntimeError ? "✗ Runtime Error" :
             "✗ Wrong Answer"}
          </span>
          {totalCount > 0 && (
            <span className="text-xs text-[#78716C]">
              {passedCount}/{totalCount} test cases passed
            </span>
          )}
        </div>

        {/* Error details */}
        {(isCompileError || isRuntimeError) && (
          <div className="bg-[#f87171]/10 border border-[#f87171]/30 p-3 rounded mb-3">
            <pre className="text-[#f87171] text-xs whitespace-pre-wrap" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {runResults.compileError || runResults.runtimeError || runResults.error || runResults.message}
            </pre>
          </div>
        )}

        {/* Test results */}
        {resultsArray.length > 0 && (
          <div className="space-y-3">
            {resultsArray.map((result, idx) => (
              <div key={idx} className={`border rounded p-3 ${
                result.passed ? "border-[#4ade80]/30 bg-[#4ade80]/5" : "border-[#f87171]/30 bg-[#f87171]/5"
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-bold ${result.passed ? "text-[#4ade80]" : "text-[#f87171]"}`}>
                    {result.passed ? "✓" : "✗"} Test Case {idx + 1}
                  </span>
                </div>
                
                {result.input !== undefined && (
                  <div className="mb-2">
                    <label className="text-[#78716C] text-[9px] uppercase tracking-wider block mb-1">Input</label>
                    <pre className="text-[#E8E4D9] text-xs bg-[#0A0A08] p-2 rounded" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {formatTestCaseValue(result.input)}
                    </pre>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[#78716C] text-[9px] uppercase tracking-wider block mb-1">Output</label>
                    <pre className="text-[#E8E4D9] text-xs bg-[#0A0A08] p-2 rounded" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {result.output || result.actual || result.stdout || "(empty)"}
                    </pre>
                  </div>
                  <div>
                    <label className="text-[#78716C] text-[9px] uppercase tracking-wider block mb-1">Expected</label>
                    <pre className="text-[#E8E4D9] text-xs bg-[#0A0A08] p-2 rounded" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {result.expected || result.expectedOutput || "(empty)"}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Runtime/Memory stats */}
        {(runResults.runtime || runResults.executionTime || runResults.memory) && (
          <div className="mt-3 pt-3 border-t border-[#1A1814] flex gap-4 text-xs text-[#78716C]">
            {(runResults.runtime || runResults.executionTime) && (
              <span>Runtime: {runResults.runtime || runResults.executionTime} ms</span>
            )}
            {runResults.memory && (
              <span>Memory: {runResults.memory} MB</span>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderOutputTab = () => (
    output ? (
      <pre
        className={`text-xs whitespace-pre-wrap leading-relaxed ${
          output.startsWith("Accepted") ? "text-[#4ade80]" :
          output.startsWith("Wrong Answer") ? "text-[#f87171]" :
          output.startsWith("Compile Error") ? "text-[#f87171]" :
          output.startsWith("Runtime Error") ? "text-[#f87171]" :
          output.startsWith("Time Limit") ? "text-[#fbbf24]" :
          output.startsWith("✓") ? "text-[#4ade80]" :
          output.startsWith("✗") ? "text-[#f87171]" :
          "text-[#E8E4D9]"
        }`}
        style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
      >
        {output}
      </pre>
    ) : (
      <div className="flex items-center justify-center h-full">
        <p
          className="text-[#3D3D3D] text-[10px] uppercase tracking-wider"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          Run or submit to see output
        </p>
      </div>
    )
  );

=======
    if (parsedData && displayResults.length > 0) {
      if (activeTab === "output" || activeTab === "testcase") {
        const currentResult = displayResults[currentTestCase];
        if (!currentResult) return null;

        return (
          <div className="space-y-4">
            {/* LeetCode-style "All Testcases Passed" Banner for Run */}
            {!parsedData.isSubmit && parsedData.allPassed && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <div className="text-green-400 font-semibold text-sm" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
                    All Testcases Passed
                  </div>
                  <div className="text-[#78716C] text-xs">
                    {parsedData.passedCount} / {parsedData.totalCount} test cases passed — Ready to submit!
                  </div>
                </div>
              </div>
            )}

            {/* LeetCode-style Status Banner for Submit */}
            {parsedData.isSubmit && (
              <div className={`rounded-lg p-4 flex items-center gap-3 ${
                parsedData.allPassed 
                  ? "bg-green-500/10 border border-green-500/30" 
                  : "bg-red-500/10 border border-red-500/30"
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  parsedData.allPassed ? "bg-green-500/20" : "bg-red-500/20"
                }`}>
                  {parsedData.allPassed 
                    ? <Check className="w-5 h-5 text-green-400" />
                    : <X className="w-5 h-5 text-red-400" />
                  }
                </div>
                <div>
                  <div className={`font-semibold text-sm ${parsedData.allPassed ? "text-green-400" : "text-red-400"}`} style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
                    {parsedData.allPassed ? "✓ Accepted" : "✗ Wrong Answer"}
                  </div>
                  <div className="text-[#78716C] text-xs">
                    {parsedData.passedCount} / {parsedData.totalCount} test cases passed
                  </div>
                </div>
              </div>
            )}

            {/* Test Case Navigation */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevTestCase}
                  disabled={currentTestCase === 0}
                  className="p-1 rounded hover:bg-[#1A1814] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-[#78716C]" />
                </button>
                <span className="text-[#E8E4D9] text-xs" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
                  Test Case {currentTestCase + 1} / {displayResults.length}
                </span>
                <button
                  onClick={handleNextTestCase}
                  disabled={currentTestCase === displayResults.length - 1}
                  className="p-1 rounded hover:bg-[#1A1814] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-[#78716C]" />
                </button>
              </div>
              
              {/* Navigation dots */}
              <div className="flex gap-1">
                {displayResults.map((r, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentTestCase(idx)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      idx === currentTestCase
                        ? r.passed ? "bg-green-400" : "bg-red-400"
                        : r.passed ? "bg-green-400/30" : "bg-red-400/30"
                    }`}
                    title={`Test Case ${idx + 1}: ${r.passed ? "Passed" : "Failed"}`}
                  />
                ))}
              </div>
            </div>

            <TestCaseDisplay 
              result={currentResult} 
              index={currentTestCase} 
              isSubmit={parsedData.isSubmit}
            />
          </div>
        );
      }

      if (activeTab === "result") {
        return (
          <SubmitResultSummary 
            parsedData={parsedData} 
            onViewTestCase={handleViewTestCase}
          />
        );
      }
    }

    // Fallback raw output
    return (
      <pre
        className="text-[#E8E4D9] text-xs whitespace-pre-wrap leading-relaxed"
        style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
      >
        {typeof output === "string" ? output : JSON.stringify(output, null, 2)}
      </pre>
    );
  };

>>>>>>> e7ba24d8e34452adb0c73fa0335031c7afca5ce6
  return (
    <div 
      className="arrakis-output border-t border-[#1A1814] bg-[#0A0A08] flex flex-col"
      style={{ height: height ? `${height}px` : undefined }}
    >
      {/* Resize Handle */}
      <div
        onMouseDown={onResizeStart}
        className="h-1 cursor-row-resize bg-[#1A1814] hover:bg-[#92400E]/50 transition-colors duration-150 shrink-0 group"
      >
        <div className="h-full w-12 mx-auto flex items-center justify-center">
          <div className="w-8 h-0.5 bg-[#3D3D3D] group-hover:bg-[#78716C] rounded-full" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between px-2 bg-[#121210] border-b border-[#1A1814]">
        <div className="flex items-center">
          <TabButton 
            active={activeTab === "testcase"} 
            onClick={() => setActiveTab("testcase")}
            badge={testCases.length}
          >
            Testcase
          </TabButton>
          <TabButton 
            active={activeTab === "result"} 
            onClick={() => setActiveTab("result")}
            badge={runResults ? `${passedCount}/${totalCount}` : undefined}
          >
            Result
          </TabButton>
          <TabButton 
            active={activeTab === "output"} 
            onClick={() => setActiveTab("output")}
          >
            Output
          </TabButton>
        </div>
        
        {/* Status Indicator */}
        {status !== "idle" && (
          <div className={`flex items-center gap-2 px-3 py-1 rounded ${
            parsedData?.allPassed ? "bg-[#22C55E]/10" : currentStatus.bg
          }`}>
            {status === "running" && (
              <div className="w-3 h-3 border-2 border-[#D97706] border-t-transparent rounded-full animate-spin" />
            )}
            {status === "success" && <Check className="w-3 h-3 text-[#22C55E]" />}
            {status === "error" && <X className="w-3 h-3 text-[#EF4444]" />}
            <span 
              className={`text-[10px] uppercase tracking-wider ${
                parsedData?.allPassed ? "text-[#22C55E]" : currentStatus.color
              }`}
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {parsedData?.status === "accepted" ? "Accepted" : 
               parsedData?.status === "wrong_answer" ? "Wrong Answer" :
               parsedData?.status === "time_limit_exceeded" ? "TLE" :
               parsedData?.status === "compile_error" ? "Compile Error" :
               parsedData?.status === "runtime_error" ? "Runtime Error" :
               currentStatus.label}
            </span>
            {parsedData && (
              <span className="text-[10px] text-[#78716C]">
                ({parsedData.passedCount}/{parsedData.totalCount})
              </span>
            )}
          </div>
        )}
      </div>

<<<<<<< HEAD
<<<<<<< HEAD
      {/* Tab Content */}
=======
      {}
>>>>>>> 87f87059bb00580ed402846e5611bd1db8259af1
      <div className="flex-1 p-4 overflow-auto">
        {activeTab === "testcase" && renderTestCaseTab()}
        {activeTab === "result" && renderResultTab()}
        {activeTab === "output" && renderOutputTab()}
=======
      {/* Content */}
      <div className="flex-1 p-4 overflow-auto">
        {renderContent()}
>>>>>>> e7ba24d8e34452adb0c73fa0335031c7afca5ce6
      </div>
    </div>
  );
}