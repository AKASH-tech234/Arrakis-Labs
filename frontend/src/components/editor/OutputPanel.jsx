
import { useState } from "react";

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

export default function OutputPanel({ output, status, height, onResizeStart }) {
  const [activeTab, setActiveTab] = useState("output");

  const statusConfig = {
    idle: { color: "text-[#3D3D3D]", bg: "", label: "" },
    running: { color: "text-[#D97706]", bg: "bg-[#D97706]/10", label: "Running..." },
    success: { color: "text-[#78716C]", bg: "bg-[#78716C]/10", label: "Accepted" },
    error: { color: "text-[#92400E]", bg: "bg-[#92400E]/10", label: "Error" },
  };

  const currentStatus = statusConfig[status] || statusConfig.idle;

  return (
    <div 
      className="arrakis-output border-t border-[#1A1814] bg-[#0A0A08] flex flex-col"
      style={{ height: height ? `${height}px` : undefined }}
    >
      {}
      <div
        onMouseDown={onResizeStart}
        className="h-1 cursor-row-resize bg-[#1A1814] hover:bg-[#92400E]/50 transition-colors duration-150 flex-shrink-0 group"
      >
        <div className="h-full w-12 mx-auto flex items-center justify-center">
          <div className="w-8 h-0.5 bg-[#3D3D3D] group-hover:bg-[#78716C] rounded-full" />
        </div>
      </div>

      {}
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
        
        {}
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

      {}
      <div className="flex-1 p-4 overflow-auto">
        {output ? (
          <pre
            className="text-[#E8E4D9] text-xs whitespace-pre-wrap leading-relaxed"
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
        )}
      </div>
    </div>
  );
}

