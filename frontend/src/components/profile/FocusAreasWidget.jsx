// ═══════════════════════════════════════════════════════════════════════════════
// FOCUS AREAS WIDGET
// Shows AI-recommended learning focus areas from MIM profile
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { getMIMProfile } from "../../services/ai/aiApi";

const COLORS = {
  bgCard: "#0F0F0D",
  border: "#1A1814",
  textPrimary: "#E8E4D9",
  textSecondary: "#A8A29E",
  textMuted: "#78716C",
  accent: "#D97706",
  accentLight: "#F59E0B",
  success: "#22C55E",
  info: "#3B82F6",
};

const fontFamily = "'Rajdhani', system-ui, sans-serif";

// Topic icons mapping
const TOPIC_ICONS = {
  arrays: "📊",
  strings: "🔤",
  "dynamic programming": "🧮",
  dp: "🧮",
  trees: "🌳",
  graphs: "🕸️",
  "hash tables": "🗂️",
  "binary search": "🔍",
  sorting: "📈",
  recursion: "🔄",
  "two pointers": "👆",
  "sliding window": "🪟",
  greedy: "💰",
  backtracking: "↩️",
  math: "➗",
  "bit manipulation": "🔢",
  default: "📚",
};

function getTopicIcon(topic) {
  const key = topic?.toLowerCase();
  return TOPIC_ICONS[key] || TOPIC_ICONS.default;
}

export default function FocusAreasWidget({ userId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const profile = await getMIMProfile({ userId });
      setData(profile);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePractice = (topic) => {
    navigate(`/problems?tag=${encodeURIComponent(topic)}`);
  };

  if (loading) {
    return (
      <div 
        className="rounded-xl border p-5" 
        style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.border }}
      >
        <div className="flex items-center justify-center py-6">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="w-5 h-5 border-2 border-t-transparent rounded-full"
            style={{ borderColor: COLORS.accent, borderTopColor: 'transparent' }}
          />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className="rounded-xl border p-5" 
        style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.border }}
      >
        <p className="text-sm text-center" style={{ color: COLORS.textMuted }}>
          Unable to load focus areas
        </p>
      </div>
    );
  }

  // Get focus areas from multiple sources in priority order
  const focusAreas = data?.focus_areas || [];
  const weaknesses = data?.weaknesses || [];
  const recentLearning = data?.recent_learning || [];
  
  // Combine and deduplicate
  const allFocusAreas = [...new Set([...focusAreas, ...weaknesses])].slice(0, 5);
  
  // Get learning recommendations if available
  const learningRecs = recentLearning.slice(0, 3);

  const hasData = allFocusAreas.length > 0 || learningRecs.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border p-5"
      style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.border }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-xs font-medium uppercase tracking-widest flex items-center gap-2"
          style={{ color: COLORS.textSecondary, fontFamily }}
        >
          <span>🎯</span>
          AI Focus Areas
        </h3>
        {allFocusAreas.length > 0 && (
          <span 
            className="text-[10px] px-2 py-0.5 rounded"
            style={{ backgroundColor: `${COLORS.info}20`, color: COLORS.info }}
          >
            AI Recommended
          </span>
        )}
      </div>

      {!hasData ? (
        <div className="text-center py-6">
          <div className="text-3xl mb-2">🤖</div>
          <p className="text-sm" style={{ color: COLORS.textMuted }}>
            No focus areas identified yet.
          </p>
          <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
            Complete more problems to get AI-powered recommendations.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Focus Areas */}
          {allFocusAreas.length > 0 && (
            <div className="space-y-2">
              {allFocusAreas.map((area, index) => (
                <motion.div
                  key={area}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1, type: "spring", stiffness: 100 }}
                  whileHover={{ 
                    scale: 1.02, 
                    x: 5,
                    borderColor: `${COLORS.accent}60`
                  }}
                  className="flex items-center justify-between p-3 rounded-lg border group cursor-pointer transition-shadow hover:shadow-lg"
                  style={{ 
                    backgroundColor: `${COLORS.accent}05`,
                    borderColor: `${COLORS.accent}20`
                  }}
                  onClick={() => handlePractice(area)}
                >
                  <div className="flex items-center gap-3">
                    <motion.span 
                      className="text-xl"
                      whileHover={{ scale: 1.3, rotate: 10 }}
                      transition={{ type: "spring", stiffness: 400 }}
                    >
                      {getTopicIcon(area)}
                    </motion.span>
                    <div>
                      <span 
                        className="text-sm font-medium"
                        style={{ color: COLORS.textPrimary, fontFamily }}
                      >
                        {area}
                      </span>
                      <p className="text-[10px]" style={{ color: COLORS.textMuted }}>
                        Recommended for improvement
                      </p>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1, boxShadow: `0 0 15px ${COLORS.accent}50` }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePractice(area);
                    }}
                    className="px-3 py-1.5 rounded text-xs font-medium opacity-80 group-hover:opacity-100 transition-all"
                    style={{ backgroundColor: COLORS.accent, color: COLORS.bgCard, fontFamily }}
                  >
                    Practice
                  </motion.button>
                </motion.div>
              ))}
            </div>
          )}

          {/* Recent Learning Insights */}
          {learningRecs.length > 0 && (
            <div>
              <h4 
                className="text-[10px] uppercase tracking-wider mb-2"
                style={{ color: COLORS.textMuted }}
              >
                Recent Learning Insights
              </h4>
              <div className="space-y-2">
                {learningRecs.map((rec, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className="p-2 rounded-lg text-xs"
                    style={{ backgroundColor: COLORS.border, color: COLORS.textSecondary }}
                  >
                    💡 {typeof rec === 'string' ? rec : rec.summary || rec.rationale || 'Keep practicing!'}
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Motivational Footer */}
          <div 
            className="pt-3 border-t text-center"
            style={{ borderColor: COLORS.border }}
          >
            <p className="text-[10px]" style={{ color: COLORS.textMuted }}>
              🧠 Focus on these areas to maximize your learning efficiency
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
