
import ProblemCard from "./ProblemCard";

export default function ProblemList({ problems }) {
  if (problems.length === 0) {
    return (
      <div className="py-12 text-center">
        <p
          className="text-[#A29A8C] text-base uppercase tracking-wider"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          No problems match your filters
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {}
      <div className="flex items-center justify-between gap-4 py-4 px-5 border-b border-[#666]/20">
        <div className="flex items-center gap-3">
          <span
            className="text-[#A29A8C] text-xs uppercase tracking-wider w-12 font-semibold"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Status
          </span>
          <span
            className="text-[#A29A8C] text-xs uppercase tracking-wider font-semibold"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Title
          </span>
        </div>
        <div className="flex items-center gap-6">
          <span
            className="text-[#A29A8C] text-xs uppercase tracking-wider hidden sm:block font-semibold"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Category
          </span>
          <span
            className="text-[#A29A8C] text-xs uppercase tracking-wider w-16 text-right font-semibold"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Difficulty
          </span>
        </div>
      </div>

      {}
      {problems.map((problem) => (
        <ProblemCard key={problem.id} problem={problem} />
      ))}
    </div>
  );
}
