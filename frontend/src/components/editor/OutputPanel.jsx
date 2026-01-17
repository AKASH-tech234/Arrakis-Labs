// src/components/editor/OutputPanel.jsx
export default function OutputPanel({ output, status }) {
  const statusStyles = {
    idle: "text-[#3D3D3D]",
    running: "text-[#78716C]",
    success: "text-[#78716C]",
    error: "text-[#92400E]",
  };

  return (
    <div className="border-t border-[#1A1814]">
      {/* Output Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1A1814]">
        <span
          className="text-[#3D3D3D] text-[10px] uppercase tracking-wider"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          Output
        </span>
        {status !== "idle" && (
          <span
            className={`text-[10px] uppercase tracking-wider ${statusStyles[status]}`}
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {status}
          </span>
        )}
      </div>

      {/* Output Content */}
      <div className="p-4 min-h-[120px] max-h-[200px] overflow-auto">
        {output ? (
          <pre
            className="text-[#E8E4D9] text-xs font-mono whitespace-pre-wrap"
            style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
          >
            {output}
          </pre>
        ) : (
          <p
            className="text-[#3D3D3D] text-xs uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Run or submit to see output
          </p>
        )}
      </div>
    </div>
  );
}
