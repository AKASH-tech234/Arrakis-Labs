import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Clock,
  Database,
  AlertTriangle,
  Building2,
} from "lucide-react";
import { formatExampleInput } from "../../utils/formatExampleInput";

export default function ProblemDescription({ problem }) {
  const [showHints, setShowHints] = useState(false);

  const inputFormatText =
    problem?.inputFormat ||
    "The input consists of one or more lines. Each line represents one input parameter.";

  const outputFormatText =
    problem?.outputFormat || "Print the required result to standard output.";

  const displayId =
    problem?.externalId ||
    (typeof problem?.id === "string" && problem.id.length > 8
      ? problem.id.slice(0, 6)
      : problem?.id);

  let constraints = [];
  const raw = problem?.constraints;

  if (Array.isArray(raw)) {
    if (
      raw.length > 0 &&
      typeof raw[0] === "string" &&
      raw[0].trim().startsWith("[")
    ) {
      try {
        const parsed = JSON.parse(raw[0]);
        constraints = Array.isArray(parsed) ? parsed : [];
      } catch {
        constraints = raw;
      }
    } else {
      constraints = raw;
    }
  } else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      constraints = Array.isArray(parsed) ? parsed : [];
    } catch {
      constraints = [];
    }
  }

  const examples = Array.isArray(problem?.examples) ? problem.examples : [];

  return (
    <div className="p-6 h-full overflow-auto">
      {}
      <div className="mb-6">
        <span className="text-[#3D3D3D] text-[10px] uppercase tracking-wider">
          Problem {displayId}
        </span>

        <h1 className="text-[#E8E4D9] text-lg mt-1">{problem.title}</h1>

        <div className="flex gap-4 mt-2">
          <span className="text-xs uppercase text-[#78716C]">
            {problem.difficulty}
          </span>
          <span className="text-xs uppercase text-[#78716C]">
            {problem.category}
          </span>
        </div>

        {/* Company Information */}
        <div className="mt-4 pt-4 border-t border-[#3D3D3D]">
          <div className="flex items-center gap-2 text-[#78716C]">
            <Building2 className="w-4 h-4" />
            <span className="text-[10px] uppercase tracking-wider">
              {problem.primaryCompany ? "Primary Company" : "Company"}
            </span>
          </div>
          <p className="text-[#E8E4D9] text-sm mt-1">
            {problem.primaryCompany || "General Interview Problem"}
          </p>
          
          {/* Additional companies */}
          {problem.companies?.length > 1 && (
            <div className="mt-3">
              <span className="text-[10px] uppercase text-[#78716C] tracking-wider">
                Also Asked By
              </span>
              <div className="flex flex-wrap gap-2 mt-1">
                {problem.companies
                  .filter(c => c !== problem.primaryCompany)
                  .map((company, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 rounded bg-[#1A1814] text-[#A29A8C] text-xs border border-[#3D3D3D]"
                    >
                      {company}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {}
      <p className="text-[#E8E4D9] text-sm mb-6">{problem.description}</p>

      {}
      {constraints.length > 0 && (
        <>
          <h3 className="text-[#78716C] text-[10px] uppercase mb-3">
            Constraints
          </h3>

          <ul className="space-y-3">
            {constraints.map((c, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="mt-1 w-2 h-2 bg-white rounded-full" />
                <span
                  className="text-[#E8E4D9] text-sm"
                  style={{ fontFamily: "JetBrains Mono, monospace" }}
                >
                  {c}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {}
      {examples.length > 0 && (
        <>
          <h3 className="text-[#78716C] text-[10px] uppercase mt-8 mb-3">
            Examples
          </h3>

          {examples.map((ex, i) => (
            <div key={i} className="mb-4">
              <div className="text-xs text-[#78716C]">Input:</div>
              <div className="text-xs text-[#E8E4D9]">
                {formatExampleInput(ex.input)}
              </div>

              <div className="text-xs text-[#78716C] mt-2">Output:</div>
              <div className="text-xs text-[#E8E4D9]">{ex.output}</div>
            </div>
          ))}
        </>
      )}

      <>
        <h3 className="text-[#78716C] text-[10px] uppercase mt-8 mb-3">
          Input Format
        </h3>
        <div
          className="text-[#E8E4D9] text-sm"
          style={{ fontFamily: "JetBrains Mono, monospace" }}
        >
          {inputFormatText}
        </div>
        <div className="mt-3 text-xs text-[#78716C]">
          CP format required (Codeforces-style): provide whitespace-separated values via stdin. No JSON, no brackets, no commas.
        </div>

        <h3 className="text-[#78716C] text-[10px] uppercase mt-6 mb-3">
          Output Format
        </h3>
        <div
          className="text-[#E8E4D9] text-sm"
          style={{ fontFamily: "JetBrains Mono, monospace" }}
        >
          {outputFormatText}
        </div>
      </>

      {/* AI Hints Section - Collapsible */}
      {(problem?.topic ||
        problem?.timeComplexityHint ||
        problem?.canonicalAlgorithms?.length > 0) && (
        <div className="mt-8 border-t border-[#3D3D3D] pt-4">
          <button
            onClick={() => setShowHints(!showHints)}
            className="flex items-center justify-between w-full text-left group"
          >
            <span className="flex items-center gap-2 text-[#78716C] text-[10px] uppercase tracking-wider">
              <Lightbulb className="w-3 h-3" />
              Hints & Guidance
            </span>
            {showHints ? (
              <ChevronUp className="w-4 h-4 text-[#78716C] group-hover:text-[#E8E4D9] transition-colors" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#78716C] group-hover:text-[#E8E4D9] transition-colors" />
            )}
          </button>

          {showHints && (
            <div className="mt-4 space-y-4 animate-in fade-in duration-200">
              {/* Topic Badge */}
              {problem.topic && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase text-[#78716C]">
                    Topic:
                  </span>
                  <span className="px-2 py-1 rounded bg-orange-500/20 text-orange-400 text-xs">
                    {problem.topic}
                  </span>
                </div>
              )}

              {/* Algorithms */}
              {problem.canonicalAlgorithms?.length > 0 && (
                <div>
                  <span className="text-[10px] uppercase text-[#78716C] block mb-2">
                    Recommended Techniques:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {problem.canonicalAlgorithms.map((algo, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 text-xs font-mono"
                      >
                        {algo.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Complexity Hints */}
              {(problem.timeComplexityHint || problem.spaceComplexityHint) && (
                <div className="flex gap-4">
                  {problem.timeComplexityHint && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 text-green-400" />
                      <span className="text-[10px] uppercase text-[#78716C]">
                        Time:
                      </span>
                      <span className="text-green-400 text-xs font-mono">
                        {problem.timeComplexityHint}
                      </span>
                    </div>
                  )}
                  {problem.spaceComplexityHint && (
                    <div className="flex items-center gap-2">
                      <Database className="w-3 h-3 text-purple-400" />
                      <span className="text-[10px] uppercase text-[#78716C]">
                        Space:
                      </span>
                      <span className="text-purple-400 text-xs font-mono">
                        {problem.spaceComplexityHint}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Common Mistakes */}
              {problem.commonMistakes?.length > 0 && (
                <div>
                  <span className="flex items-center gap-2 text-[10px] uppercase text-[#78716C] mb-2">
                    <AlertTriangle className="w-3 h-3" />
                    Watch Out For:
                  </span>
                  <ul className="space-y-1">
                    {problem.commonMistakes.slice(0, 3).map((mistake, i) => (
                      <li
                        key={i}
                        className="text-xs text-red-400/80 flex items-start gap-2"
                      >
                        <span className="mt-1.5 w-1 h-1 bg-red-400 rounded-full flex-shrink-0" />
                        {mistake}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
