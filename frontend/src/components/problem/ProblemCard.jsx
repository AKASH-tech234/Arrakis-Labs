
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

export default function ProblemCard({ problem, index }) {
  const { id, title, difficulty, category, solved } = problem;
  const displaySequential = typeof index === "number" ? index + 1 : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Link
        to={`/problems/${id}`}
        className={`group block relative overflow-hidden rounded-lg border border-[#D97706]/20 py-5 px-5 transition-all duration-300 ${difficultyBgStyles[difficulty]} hover:border-[#D97706]/50 hover:shadow-lg hover:shadow-[#D97706]/25`}
      >
        {}
        <div className="absolute inset-0 bg-gradient-to-r from-[#D97706]/0 via-[#D97706]/8 to-[#92400E]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

        {}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#D97706] via-[#F59E0B] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

        <div className="relative z-10 flex items-center justify-between gap-4">
          {}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
<<<<<<< HEAD
              {/* Sequential number badge */}
              {displaySequential !== null && (
                <motion.div
                  className="flex items-center justify-center w-10 h-10 rounded border-2 border-[#D97706] bg-[#0A0A08] group-hover:bg-[#D97706]/10 group-hover:border-[#F59E0B] transition-all duration-300"
                  whileHover={{ scale: 1.03 }}
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  <span className="text-[#F59E0B] text-sm font-bold">{displaySequential}</span>
                </motion.div>
              )}

              {/* Solved indicator */}
=======
              {}
>>>>>>> 87f87059bb00580ed402846e5611bd1db8259af1
              <motion.span
                className={`text-xs uppercase tracking-wider transition-colors duration-300 ${
                  solved ? "text-[#D97706] group-hover:text-[#F59E0B]" : "text-[#666] group-hover:text-[#999]"
                }`}
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                whileHover={{ scale: 1.1 }}
              >
                {solved ? "✓ solved" : "—"}
              </motion.span>

              {}
              <h3
                className="text-[#E8E4D9] text-base font-semibold truncate group-hover:text-[#FCD34D] transition-colors duration-300"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                {title}
              </h3>
            </div>
          </div>

          {}
          <div className="flex items-center gap-6">
            <span
              className="text-[#A29A8C] text-sm uppercase tracking-wider hidden sm:block group-hover:text-[#D97706] transition-colors duration-300"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {category}
            </span>
            <span
              className={`text-sm uppercase tracking-wider w-16 text-right font-semibold transition-colors duration-300 ${difficultyStyles[difficulty]}`}
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
