// src/components/mim/CognitiveProfile.jsx
// Displays user's MIM cognitive profile with strengths and weaknesses
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getMIMProfile } from "../../services/aiApi";

const SkillBar = ({
  label,
  value,
  maxValue = 100,
  color = "#D97706",
  delay = 0,
}) => {
  const percentage = Math.min((value / maxValue) * 100, 100);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay }}
      className="mb-3"
    >
      <div className="flex justify-between mb-1">
        <span
          className="text-[#A8A29E] text-xs uppercase tracking-wider"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          {label}
        </span>
        <span
          className="text-[#E8E4D9] text-xs"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          {value}%
        </span>
      </div>
      <div className="h-2 bg-[#1A1814] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, delay: delay + 0.2, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </motion.div>
  );
};

const CategoryBadge = ({ category, type, delay = 0 }) => {
  const isStrength = type === "strength";
  const bgColor = isStrength ? "bg-[#D97706]/15" : "bg-[#92400E]/15";
  const textColor = isStrength ? "text-[#F59E0B]" : "text-[#D97706]";
  const borderColor = isStrength
    ? "border-[#D97706]/30"
    : "border-[#92400E]/30";

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay }}
      className={`inline-flex items-center px-3 py-1.5 rounded-lg border ${bgColor} ${borderColor} ${textColor} text-xs uppercase tracking-wider mr-2 mb-2`}
      style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
    >
      {isStrength ? "✓ " : "⚠ "}
      {category}
    </motion.span>
  );
};

export default function CognitiveProfile({ userId, compact = false }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    getMIMProfile({ userId })
      .then((data) => {
        if (!cancelled) {
          setProfile(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Failed to load cognitive profile");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="rounded-lg border border-[#D97706]/20 bg-[#0A0A08]/60 p-6">
        <div className="flex items-center justify-center py-8">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="w-6 h-6 border-2 border-[#D97706] border-t-transparent rounded-full"
          />
          <span className="ml-3 text-[#78716C] text-sm">
            Loading profile...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[#92400E]/30 bg-[#92400E]/5 p-6">
        <p className="text-[#D97706] text-sm">{error}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-lg border border-[#D97706]/20 bg-[#0A0A08]/60 p-6">
        <p className="text-[#78716C] text-sm text-center">
          No cognitive profile available yet. Complete more problems to build
          your profile.
        </p>
      </div>
    );
  }

  const {
    strengths = [],
    weaknesses = [],
    readiness_scores = {},
    learning_trajectory = {},
  } = profile;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-lg border border-[#D97706]/20 bg-gradient-to-br from-[#1A1814]/60 to-[#0A0A08]/60 backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#D97706]/10">
        <div className="flex items-center gap-2">
          <span className="text-[#D97706]">🧠</span>
          <h3
            className="text-[#E8E4D9] text-sm uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Cognitive Profile
          </h3>
        </div>
        {learning_trajectory?.trend && (
          <p className="text-[#78716C] text-xs mt-1">
            Trend:{" "}
            <span className="text-[#D97706]">{learning_trajectory.trend}</span>
          </p>
        )}
      </div>

      <div className="p-6">
        {/* Strengths & Weaknesses */}
        {!compact && (
          <>
            {/* Strengths */}
            {strengths.length > 0 && (
              <div className="mb-6">
                <h4
                  className="text-[#78716C] text-xs uppercase tracking-wider mb-3"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  Strengths
                </h4>
                <div className="flex flex-wrap">
                  {strengths.map((s, i) => (
                    <CategoryBadge
                      key={s}
                      category={s}
                      type="strength"
                      delay={i * 0.1}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Weaknesses */}
            {weaknesses.length > 0 && (
              <div className="mb-6">
                <h4
                  className="text-[#78716C] text-xs uppercase tracking-wider mb-3"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  Areas to Improve
                </h4>
                <div className="flex flex-wrap">
                  {weaknesses.map((w, i) => (
                    <CategoryBadge
                      key={w}
                      category={w}
                      type="weakness"
                      delay={i * 0.1}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Readiness Scores */}
        {Object.keys(readiness_scores).length > 0 && (
          <div>
            <h4
              className="text-[#78716C] text-xs uppercase tracking-wider mb-3"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Readiness by Difficulty
            </h4>
            {Object.entries(readiness_scores).map(([level, score], i) => (
              <SkillBar
                key={level}
                label={level}
                value={Math.round(score * 100)}
                color={
                  level === "Easy"
                    ? "#78716C"
                    : level === "Medium"
                      ? "#D97706"
                      : "#92400E"
                }
                delay={i * 0.1}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
