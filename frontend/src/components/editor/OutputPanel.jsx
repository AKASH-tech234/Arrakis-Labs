// src/components/editor/OutputPanel.jsx
import { useState } from "react";

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

  const statusConfig = {
    idle: { color: "text-[#3D3D3D]", bg: "", label: "" },
    running: { color: "text-[#D97706]", bg: "bg-[#D97706]/10", label: "Running..." },
    success: { color: "text-[#4ade80]", bg: "bg-[#4ade80]/10", label: "Accepted" },
    error: { color: "text-[#f87171]", bg: "bg-[#f87171]/10", label: "Wrong Answer" },
  };

  const currentStatus = statusConfig[status] || statusConfig.idle;

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
          </p>
        </div>
      );
    }

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

      {/* Tab Bar */}
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
        
        {/* Status indicator */}
        {status !== "idle" && (
          <div className={`flex items-center gap-2 px-3 py-1 ${currentStatus.bg}`}>
            {status === "running" && (
              <div className="w-3 h-3 border-2 border-[#D97706] border-t-transparent rounded-full animate-spin" />
            )}
            <span 
              className={`text-[10px] uppercase tracking-wider ${currentStatus.color}`}
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {currentStatus.label}
            </span>
          </div>
        )}
      </div>

      {/* Tab Content */}
      <div className="flex-1 p-4 overflow-auto">
        {activeTab === "testcase" && renderTestCaseTab()}
        {activeTab === "result" && renderResultTab()}
        {activeTab === "output" && renderOutputTab()}
      </div>
    </div>
  );
}