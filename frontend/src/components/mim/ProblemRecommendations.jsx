// src/components/mim/ProblemRecommendations.jsx
// Displays MIM-recommended problems for the user
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { getMIMRecommendations } from "../../services/ai/aiApi";

const difficultyStyles = {
  Easy: "text-[#78716C] group-hover:text-[#F59E0B]",
  Medium: "text-[#D97706] group-hover:text-[#FCD34D]",
  Hard: "text-[#92400E] group-hover:text-[#F59E0B]",
};

const ConfidenceIndicator = ({ confidence }) => {
  const percentage = Math.round(confidence * 100);
  let color = "#78716C";
  let label = "Low";

  if (percentage >= 70) {
    color = "#22C55E";
    label = "High";
  } else if (percentage >= 40) {
    color = "#D97706";
    label = "Medium";
  }

  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-[#1A1814] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] text-[#78716C] uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
};

const RecommendationCard = ({ recommendation, index }) => {
  const { problem_id, title, difficulty, category, confidence, reason } =
    recommendation;
  const [showReason, setShowReason] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
    >
      <Link
        to={`/problems/${problem_id}`}
        className="group block relative overflow-hidden rounded-lg border border-[#D97706]/20 py-4 px-5 transition-all duration-300 hover:border-[#D97706]/50 hover:shadow-lg hover:shadow-[#D97706]/15 bg-[#0A0A08]/40"
      >
        {/* Hover gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#D97706]/0 via-[#D97706]/5 to-[#92400E]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#D97706] via-[#F59E0B] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="relative z-10">
          {/* Header row */}
          <div className="flex items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-[#D97706] text-xs">#{index + 1}</span>
              <h4
                className="text-[#E8E4D9] text-sm font-semibold truncate group-hover:text-[#FCD34D] transition-colors"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                {title || `Problem ${problem_id}`}
              </h4>
            </div>
            <span
              className={`text-xs uppercase tracking-wider ${difficultyStyles[difficulty] || "text-[#78716C]"}`}
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {difficulty || "Unknown"}
            </span>
          </div>

          {/* Meta row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {category && (
                <span className="text-[#78716C] text-xs uppercase tracking-wider">
                  {category}
                </span>
              )}
              <ConfidenceIndicator confidence={confidence || 0.5} />
            </div>

            {reason && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setShowReason(!showReason);
                }}
                className="text-[#78716C] hover:text-[#D97706] text-xs transition-colors"
              >
                {showReason ? "Hide why" : "Why?"}
              </button>
            )}
          </div>

          {/* Reason tooltip */}
          <AnimatePresence>
            {showReason && reason && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 pt-3 border-t border-[#D97706]/10"
              >
                <p className="text-[#A8A29E] text-xs leading-relaxed">
                  {reason}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Link>
    </motion.div>
  );
};

export default function ProblemRecommendations({
  userId,
  limit = 5,
  title = "Recommended for You",
}) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    getMIMRecommendations({ userId, limit })
      .then((data) => {
        if (!cancelled) {
          setRecommendations(data?.recommendations || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Failed to load recommendations");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId, limit]);

  // Don't render if no userId
  if (!userId) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-lg border border-[#D97706]/20 bg-gradient-to-br from-[#1A1814]/60 to-[#0A0A08]/60 backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#D97706]/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[#D97706]">🎯</span>
          <h3
            className="text-[#E8E4D9] text-sm uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {title}
          </h3>
        </div>
        {recommendations.length > 0 && (
          <span className="text-[#78716C] text-xs">
            {recommendations.length} problem
            {recommendations.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              className="w-6 h-6 border-2 border-[#D97706] border-t-transparent rounded-full"
            />
            <span className="ml-3 text-[#78716C] text-sm">
              Finding best problems...
            </span>
          </div>
        )}

        {!loading && error && (
          <div className="py-6 text-center">
            <p className="text-[#D97706] text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && recommendations.length === 0 && (
          <div className="py-6 text-center">
            <p className="text-[#78716C] text-sm">
              Complete more problems to get personalized recommendations.
            </p>
          </div>
        )}

        {!loading && !error && recommendations.length > 0 && (
          <div className="space-y-3">
            {recommendations.map((rec, i) => (
              <RecommendationCard
                key={rec.problem_id || i}
                recommendation={rec}
                index={i}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
