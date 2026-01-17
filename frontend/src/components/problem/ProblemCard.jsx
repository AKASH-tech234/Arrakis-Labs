// src/components/problem/ProblemCard.jsx
import { Link } from "react-router-dom";

const difficultyStyles = {
  Easy: "text-[#78716C]",
  Medium: "text-[#D97706]",
  Hard: "text-[#92400E]",
};

export default function ProblemCard({ problem }) {
  const { id, title, difficulty, category, solved } = problem;

  return (
    <Link
      to={`/problems/${id}`}
      className="block border-b border-[#1A1814] py-4 hover:bg-[#0D0D0B] transition-colors duration-200 px-4 -mx-4"
    >
      <div className="flex items-center justify-between gap-4">
        {/* Left: Title and Category */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            {/* Solved indicator */}
            <span
              className={`text-[10px] uppercase tracking-wider ${
                solved ? "text-[#78716C]" : "text-[#3D3D3D]"
              }`}
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {solved ? "solved" : "—"}
            </span>

            {/* Title */}
            <h3
              className="text-[#E8E4D9] text-sm truncate"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {title}
            </h3>
          </div>
        </div>

        {/* Right: Category and Difficulty */}
        <div className="flex items-center gap-6">
          <span
            className="text-[#78716C] text-xs uppercase tracking-wider hidden sm:block"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {category}
          </span>
          <span
            className={`text-xs uppercase tracking-wider w-16 text-right ${difficultyStyles[difficulty]}`}
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {difficulty}
          </span>
        </div>
      </div>
    </Link>
  );
}
