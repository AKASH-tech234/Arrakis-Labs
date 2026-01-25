
import { formatExampleInput } from "../../utils/formatExampleInput";

export default function ProblemDescription({ problem }) {
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

        <h1 className="text-[#E8E4D9] text-lg mt-1">
          {problem.title}
        </h1>

        <div className="flex gap-4 mt-2">
          <span className="text-xs uppercase text-[#78716C]">
            {problem.difficulty}
          </span>
          <span className="text-xs uppercase text-[#78716C]">
            {problem.category}
          </span>
        </div>
      </div>

      {}
      <p className="text-[#E8E4D9] text-sm mb-6">
        {problem.description}
      </p>

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
              <div className="text-xs text-[#E8E4D9]">
                {ex.output}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
