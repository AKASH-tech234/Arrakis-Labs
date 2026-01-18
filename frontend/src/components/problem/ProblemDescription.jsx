// src/components/problem/ProblemDescription.jsx
export default function ProblemDescription({ problem }) {
  const displayId =
    problem?.externalId ||
    (typeof problem?.id === "string" && problem.id.length > 8
      ? problem.id.slice(0, 6)
      : problem?.id);

  const constraints = Array.isArray(problem?.constraints) ? problem.constraints : [];
  const examples = Array.isArray(problem?.examples) ? problem.examples : [];

  return (
    <div className="p-6 h-full overflow-auto">
      {/* Problem Title */}
      <div className="mb-6">
        <span
          className="text-[#3D3D3D] text-[10px] uppercase tracking-wider"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          Problem {displayId}
        </span>
        <h1
          className="text-[#E8E4D9] text-lg font-medium tracking-wide mt-1"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          {problem.title}
        </h1>
        <div className="flex items-center gap-4 mt-2">
          <span
            className={`text-xs uppercase tracking-wider ${
              problem.difficulty === "Easy"
                ? "text-[#78716C]"
                : problem.difficulty === "Medium"
                ? "text-[#D97706]"
                : "text-[#92400E]"
            }`}
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {problem.difficulty}
          </span>
          <span
            className="text-[#78716C] text-xs uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {problem.category}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-[#1A1814] my-6" />

      {/* Description */}
      <div className="space-y-4">
        <p
          className="text-[#E8E4D9] text-sm leading-relaxed"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          {problem.description}
        </p>
      </div>

      {/* Constraints */}
      {constraints.length > 0 && (
        <>
          <div className="border-t border-[#1A1814] my-6" />
          <div>
            <h3
              className="text-[#78716C] text-[10px] uppercase tracking-wider mb-3"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Constraints
            </h3>
            <ul className="space-y-1">
              {constraints.map((constraint, index) => (
                <li
                  key={index}
                  className="text-[#E8E4D9] text-xs"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  • {constraint}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* Examples */}
      {examples.length > 0 && (
        <>
          <div className="border-t border-[#1A1814] my-6" />
          <div className="space-y-4">
            <h3
              className="text-[#78716C] text-[10px] uppercase tracking-wider"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Examples
            </h3>
            {examples.map((example, index) => (
              <div key={index} className="space-y-2">
                <p
                  className="text-[#3D3D3D] text-[10px] uppercase tracking-wider"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  Example {index + 1}
                </p>
                <div className="bg-[#0D0D0B] border border-[#1A1814] p-3">
                  <div className="mb-2">
                    <span
                      className="text-[#78716C] text-[10px] uppercase tracking-wider"
                      style={{
                        fontFamily: "'Rajdhani', system-ui, sans-serif",
                      }}
                    >
                      Input:{" "}
                    </span>
                    <span
                      className="text-[#E8E4D9] text-xs"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {example.input}
                    </span>
                  </div>
                  <div>
                    <span
                      className="text-[#78716C] text-[10px] uppercase tracking-wider"
                      style={{
                        fontFamily: "'Rajdhani', system-ui, sans-serif",
                      }}
                    >
                      Output:{" "}
                    </span>
                    <span
                      className="text-[#E8E4D9] text-xs"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {example.output}
                    </span>
                  </div>
                  {example.explanation && (
                    <div className="mt-2 pt-2 border-t border-[#1A1814]">
                      <span
                        className="text-[#78716C] text-[10px] uppercase tracking-wider"
                        style={{
                          fontFamily: "'Rajdhani', system-ui, sans-serif",
                        }}
                      >
                        Explanation:{" "}
                      </span>
                      <span
                        className="text-[#78716C] text-xs"
                        style={{
                          fontFamily: "'Rajdhani', system-ui, sans-serif",
                        }}
                      >
                        {example.explanation}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
