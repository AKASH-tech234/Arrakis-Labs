// src/components/problem/ProblemCard.jsx
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const difficultyStyles = {
  Easy: "text-[#78716C] group-hover:text-[#F59E0B]",
  Medium: "text-[#D97706] group-hover:text-[#FCD34D]",
  Hard: "text-[#92400E] group-hover:text-[#F59E0B]",
};

const difficultyBgStyles = {
  Easy: "group-hover:bg-[#78716C]/10",
  Medium: "group-hover:bg-[#D97706]/15",
  Hard: "group-hover:bg-[#92400E]/10",
};

export default function ProblemCard({ problem }) {
  const { id, title, difficulty, category, solved } = problem;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Link
        to={`/problems/${id}`}
        className={`group block relative overflow-hidden rounded-lg border border-[#D97706]/10 py-4 px-4 transition-all duration-300 ${difficultyBgStyles[difficulty]} hover:border-[#D97706]/40 hover:shadow-lg hover:shadow-[#D97706]/20`}
      >
        {/* Hover Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#D97706]/0 via-[#D97706]/5 to-[#92400E]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

        {/* Top accent line on hover */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#D97706] via-[#F59E0B] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

        <div className="relative z-10 flex items-center justify-between gap-4">
          {/* Left: Title and Category */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              {/* Solved indicator */}
              <motion.span
                className={`text-[10px] uppercase tracking-wider transition-colors duration-300 ${
                  solved ? "text-[#78716C] group-hover:text-[#D97706]" : "text-[#3D3D3D] group-hover:text-[#666]"
                }`}
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                whileHover={{ scale: 1.1 }}
              >
                {solved ? "✓ solved" : "—"}
              </motion.span>

              {/* Title */}
              <h3
                className="text-[#E8E4D9] text-sm truncate group-hover:text-[#FCD34D] transition-colors duration-300"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                {title}
              </h3>
            </div>
          </div>

          {/* Right: Category and Difficulty */}
          <div className="flex items-center gap-6">
            <span
              className="text-[#78716C] text-xs uppercase tracking-wider hidden sm:block group-hover:text-[#D97706] transition-colors duration-300"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {category}
            </span>
            <span
              className={`text-xs uppercase tracking-wider w-16 text-right font-medium transition-colors duration-300 ${difficultyStyles[difficulty]}`}
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {difficulty}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
