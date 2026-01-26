import { useState, useMemo, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, Check, X, Clock, AlertTriangle } from "lucide-react";

const TabButton = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 text-[10px] uppercase tracking-wider transition-colors duration-150 border-b-2 ${
      active
        ? "text-[#F59E0B] border-[#F59E0B]"
        : "text-[#78716C] border-transparent hover:text-[#E8E4D9]"
    }`}
    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
  >
    {children}
  </button>
);

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

  const statusConfig = {
    idle: { color: "text-[#3D3D3D]", bg: "", label: "" },
    running: { color: "text-[#D97706]", bg: "bg-[#D97706]/10", label: "Running..." },
    success: { color: "text-[#22C55E]", bg: "bg-[#22C55E]/10", label: "Accepted" },
    error: { color: "text-[#EF4444]", bg: "bg-[#EF4444]/10", label: "Wrong Answer" },
  };

  const currentStatus = statusConfig[status] || statusConfig.idle;

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
          </p>
        </div>
      );
    }

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

  return (
    <div 
      className="arrakis-output border-t border-[#1A1814] bg-[#0A0A08] flex flex-col"
      style={{ height: height ? `${height}px` : undefined }}
    >
      {/* Resize Handle */}
      <div
        onMouseDown={onResizeStart}
        className="h-1 cursor-row-resize bg-[#1A1814] hover:bg-[#92400E]/50 transition-colors duration-150 flex-shrink-0 group"
      >
        <div className="h-full w-12 mx-auto flex items-center justify-center">
          <div className="w-8 h-0.5 bg-[#3D3D3D] group-hover:bg-[#78716C] rounded-full" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between px-2 bg-[#121210] border-b border-[#1A1814]">
        <div className="flex items-center">
          <TabButton 
            active={activeTab === "output"} 
            onClick={() => setActiveTab("output")}
          >
            Output
          </TabButton>
          <TabButton 
            active={activeTab === "testcase"} 
            onClick={() => setActiveTab("testcase")}
          >
            Testcase
          </TabButton>
          <TabButton 
            active={activeTab === "result"} 
            onClick={() => setActiveTab("result")}
          >
            Result
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

      {/* Content */}
      <div className="flex-1 p-4 overflow-auto">
        {renderContent()}
      </div>
    </div>
  );
}