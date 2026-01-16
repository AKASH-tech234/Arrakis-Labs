// src/components/problem/ProblemList.jsx
import ProblemCard from "./ProblemCard";

export default function ProblemList({ problems }) {
  if (problems.length === 0) {
    return (
      <div className="py-12 text-center">
        <p
          className="text-[#78716C] text-sm uppercase tracking-wider"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          No problems match your filters
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-[#1A1814]">
      {/* Table Header */}
      <div className="flex items-center justify-between gap-4 py-3 px-4 -mx-4 border-b border-[#1A1814]">
        <div className="flex items-center gap-3">
          <span
            className="text-[#3D3D3D] text-[10px] uppercase tracking-wider w-12"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Status
          </span>
          <span
            className="text-[#3D3D3D] text-[10px] uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Title
          </span>
        </div>
        <div className="flex items-center gap-6">
          <span
            className="text-[#3D3D3D] text-[10px] uppercase tracking-wider hidden sm:block"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Category
          </span>
          <span
            className="text-[#3D3D3D] text-[10px] uppercase tracking-wider w-16 text-right"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Difficulty
          </span>
        </div>
      </div>

      {/* Problem Items */}
      {problems.map((problem) => (
        <ProblemCard key={problem.id} problem={problem} />
      ))}
    </div>
  );
}
