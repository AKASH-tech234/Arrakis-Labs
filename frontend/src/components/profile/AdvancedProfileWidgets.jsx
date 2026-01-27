// src/components/profile/AdvancedProfileWidgets.jsx
// Advanced dynamic profile widgets - fetches data from backend/AI service
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { getMIMProfile, getMIMRecommendations } from "../../services/ai/aiApi";

// ═══════════════════════════════════════════════════════════════════════════════
// THEME CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
const COLORS = {
  bg: "#0A0A08",
  bgCard: "#0F0F0D",
  border: "#1A1814",
  borderHover: "#D97706",
  textPrimary: "#E8E4D9",
  textSecondary: "#A8A29E",
  textMuted: "#78716C",
  accent: "#D97706",
  accentLight: "#F59E0B",
  success: "#22C55E",
  warning: "#F59E0B",
  error: "#EF4444",
};

const fontFamily = "'Rajdhani', system-ui, sans-serif";

// ═══════════════════════════════════════════════════════════════════════════════
// REFRESH EVENT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
const advancedWidgetListeners = new Set();

export function emitAdvancedWidgetsRefresh() {
  advancedWidgetListeners.forEach((listener) => {
    try { listener(); } catch (e) { console.error(e); }
  });
}

function useAdvancedWidgetsRefresh(onRefresh) {
  useEffect(() => {
    if (onRefresh) {
      advancedWidgetListeners.add(onRefresh);
      return () => advancedWidgetListeners.delete(onRefresh);
    }
  }, [onRefresh]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. TOPIC MASTERY GRID
// Grid showing mastery percentage per topic with visual indicators
// Uses REAL data from AI profile - readiness_scores and learning_trajectory
// ═══════════════════════════════════════════════════════════════════════════════
export function TopicMasteryGrid({ userId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
  useAdvancedWidgetsRefresh(fetchData);

  // Build topic mastery from REAL profile data
  const buildTopicMastery = () => {
    if (!data) return [];
    
    const topics = [];
    const readiness = data.readiness_scores || {};
    const trajectory = data.learning_trajectory || {};
    const successRate = (trajectory.success_rate || 0) / 100; // Convert percentage to 0-1
    
    // Add difficulty readiness as primary mastery indicators (REAL data)
    Object.entries(readiness).forEach(([diff, score]) => {
      const numericScore = typeof score === 'number' ? score : parseFloat(score) || 0;
      topics.push({ 
        name: `${diff}`, 
        mastery: numericScore, 
        status: numericScore >= 0.6 ? "strong" : numericScore >= 0.4 ? "medium" : "weak" 
      });
    });
    
    // Add overall success rate if available
    if (trajectory.total_submissions > 0) {
      topics.push({
        name: "Overall",
        mastery: successRate,
        status: successRate >= 0.6 ? "strong" : successRate >= 0.4 ? "medium" : "weak"
      });
    }
    
    // Add category performance if available in learning_trajectory
    const categoryPerf = data.category_performance || trajectory.category_performance || {};
    Object.entries(categoryPerf).forEach(([cat, perf]) => {
      if (topics.length >= 9) return; // Max 9 for grid
      const rate = typeof perf === 'object' 
        ? (perf.passed / perf.total) || 0 
        : perf;
      topics.push({
        name: cat,
        mastery: rate,
        status: rate >= 0.6 ? "strong" : rate >= 0.4 ? "medium" : "weak"
      });
    });
    
    return topics.slice(0, 9); // Max 9 for 3x3 grid
  };

  const getMasteryColor = (mastery) => {
    if (mastery >= 0.6) return COLORS.success;
    if (mastery >= 0.4) return COLORS.warning;
    return COLORS.error;
  };

  if (loading) {
    return (
      <div className="rounded-xl border p-5" style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.border }}>
        <div className="flex items-center justify-center py-8">
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
      <div className="rounded-xl border p-5" style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.border }}>
        <p className="text-sm text-center" style={{ color: COLORS.textMuted }}>
          Unable to load topic mastery
        </p>
      </div>
    );
  }

  const topics = buildTopicMastery();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border p-5"
      style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.border }}
    >
      <h3
        className="text-xs font-medium uppercase tracking-widest mb-4"
        style={{ color: COLORS.textSecondary, fontFamily }}
      >
        Topic Mastery
      </h3>

      {topics.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm" style={{ color: COLORS.textMuted }}>
            Solve more problems to see your topic mastery.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {topics.map((topic, index) => (
            <motion.div
              key={topic.name}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className="relative p-3 rounded-lg border text-center"
              style={{
                backgroundColor: `${getMasteryColor(topic.mastery)}10`,
                borderColor: `${getMasteryColor(topic.mastery)}30`,
              }}
            >
              {/* Circular progress indicator */}
              <div className="relative w-12 h-12 mx-auto mb-2">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="24" cy="24" r="20"
                    fill="none"
                    stroke={COLORS.border}
                    strokeWidth="4"
                  />
                  <motion.circle
                    cx="24" cy="24" r="20"
                    fill="none"
                    stroke={getMasteryColor(topic.mastery)}
                    strokeWidth="4"
                    strokeLinecap="round"
                    initial={{ strokeDashoffset: 126 }}
                    animate={{ strokeDashoffset: 126 - (126 * topic.mastery) }}
                    transition={{ duration: 0.8, delay: index * 0.05 }}
                    style={{ strokeDasharray: 126 }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold" style={{ color: getMasteryColor(topic.mastery) }}>
                    {Math.round(topic.mastery * 100)}%
                  </span>
                </div>
              </div>
              <span className="text-xs" style={{ color: COLORS.textPrimary, fontFamily }}>
                {topic.name}
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. NEXT PROBLEM CARD
// Single highlighted "Your Next Challenge" card with REAL problem details
// ═══════════════════════════════════════════════════════════════════════════════
export function NextProblemCard({ userId }) {
  const [recommendation, setRecommendation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      console.log("[NextProblemCard] Fetching recommendations for:", userId);
      const data = await getMIMRecommendations({ userId, limit: 3 }); // Fetch a few to filter duplicates
      console.log("[NextProblemCard] Response:", data);
      
      if (data && data.recommendations && data.recommendations.length > 0) {
        // Filter duplicates by ID and title, get the first unique one
        const seenIds = new Set();
        const seenTitles = new Set();
        const uniqueRecs = data.recommendations.filter(rec => {
          const id = rec.problem_id;
          const title = (rec.title || '').toLowerCase().trim();
          
          if (seenIds.has(id) || seenTitles.has(title)) return false;
          
          if (id) seenIds.add(id);
          if (title) seenTitles.add(title);
          return true;
        });
        setRecommendation(uniqueRecs[0] || null);
      } else {
        setRecommendation(null);
      }
    } catch (err) {
      console.error("[NextProblemCard] Error:", err);
      setError(err.message || "Failed to load recommendation");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useAdvancedWidgetsRefresh(fetchData);

  const getDifficultyColor = (difficulty) => {
    switch (difficulty?.toLowerCase()) {
      case "easy": return COLORS.success;
      case "medium": return COLORS.warning;
      case "hard": return COLORS.error;
      default: return COLORS.accent;
    }
  };

  const handleStartProblem = () => {
    if (recommendation?.problem_id) {
      navigate(`/problems/${recommendation.problem_id}`);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border p-5" style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.border }}>
        <h3 className="text-xs font-medium uppercase tracking-widest mb-4" style={{ color: COLORS.textSecondary, fontFamily }}>
          🎯 Your Next Challenge
        </h3>
        <div className="flex items-center justify-center py-6">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="w-5 h-5 border-2 border-t-transparent rounded-full"
            style={{ borderColor: COLORS.accent, borderTopColor: 'transparent' }}
          />
          <span className="ml-2 text-xs" style={{ color: COLORS.textMuted }}>Finding best problem...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-xl border p-5"
        style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.border }}
      >
        <h3 className="text-xs font-medium uppercase tracking-widest mb-4" style={{ color: COLORS.textSecondary, fontFamily }}>
          🎯 Your Next Challenge
        </h3>
        <div className="text-center py-4">
          <p className="text-sm" style={{ color: COLORS.error }}>{error}</p>
          <button
            onClick={fetchData}
            className="mt-2 text-xs px-3 py-1 rounded"
            style={{ backgroundColor: COLORS.accent, color: COLORS.bg }}
          >
            Retry
          </button>
        </div>
      </motion.div>
    );
  }

  if (!recommendation) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-xl border p-5"
        style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.border }}
      >
        <h3 className="text-xs font-medium uppercase tracking-widest mb-4" style={{ color: COLORS.textSecondary, fontFamily }}>
          🎯 Your Next Challenge
        </h3>
        <div className="text-center py-4">
          <div className="text-2xl mb-2">🎯</div>
          <p className="text-sm" style={{ color: COLORS.textMuted }}>
            Complete more problems to get personalized recommendations.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border p-5 relative overflow-hidden"
      style={{ 
        backgroundColor: COLORS.bgCard, 
        borderColor: COLORS.accent,
        boxShadow: `0 0 20px ${COLORS.accent}20`
      }}
    >
      {/* Accent glow */}
      <div 
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: COLORS.accent }}
      />

      <div className="flex items-start justify-between mb-3">
        <h3 className="text-xs font-medium uppercase tracking-widest" style={{ color: COLORS.accent, fontFamily }}>
          🎯 Your Next Challenge
        </h3>
        <span
          className="text-xs px-2 py-0.5 rounded"
          style={{
            backgroundColor: `${getDifficultyColor(recommendation.difficulty)}20`,
            color: getDifficultyColor(recommendation.difficulty),
          }}
        >
          {recommendation.difficulty}
        </span>
      </div>

      <h4 className="text-lg font-bold mb-2 line-clamp-2" style={{ color: COLORS.textPrimary, fontFamily }}>
        {recommendation.title}
      </h4>

      <p className="text-xs mb-3" style={{ color: COLORS.textMuted }}>
        {recommendation.reason}
      </p>

      <div className="flex items-center justify-between">
        <span
          className="text-xs px-2 py-1 rounded"
          style={{ backgroundColor: COLORS.border, color: COLORS.textSecondary }}
        >
          {recommendation.category}
        </span>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleStartProblem}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ backgroundColor: COLORS.accent, color: COLORS.bg, fontFamily }}
        >
          Start Now →
        </motion.button>
      </div>

      {recommendation.is_review && (
        <div className="mt-3 pt-3 border-t text-xs" style={{ borderColor: COLORS.border, color: COLORS.warning }}>
          ⚠️ This is a problem you struggled with before. Give it another try!
        </div>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. WEAK AREA FOCUS
// Highlighted weak topics with practice suggestions - uses REAL profile data
// ═══════════════════════════════════════════════════════════════════════════════
export function WeakAreaFocus({ userId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      console.log("[WeakAreaFocus] Fetching profile for:", userId);
      const profile = await getMIMProfile({ userId });
      console.log("[WeakAreaFocus] Response:", profile);
      setData(profile);
    } catch (err) {
      console.error("[WeakAreaFocus] Error:", err);
      setError(err.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useAdvancedWidgetsRefresh(fetchData);

  const handlePractice = (topic) => {
    // Navigate to problems filtered by topic
    navigate(`/problems?tag=${encodeURIComponent(topic)}`);
  };

  if (loading) {
    return (
      <div className="rounded-xl border p-5" style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.border }}>
        <h3 className="text-xs font-medium uppercase tracking-widest mb-4" style={{ color: COLORS.textSecondary, fontFamily }}>
          Areas to Improve
        </h3>
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
      <div className="rounded-xl border p-5" style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.border }}>
        <h3 className="text-xs font-medium uppercase tracking-widest mb-4" style={{ color: COLORS.textSecondary, fontFamily }}>
          Areas to Improve
        </h3>
        <div className="text-center py-4">
          <p className="text-sm" style={{ color: COLORS.error }}>{error}</p>
          <button
            onClick={fetchData}
            className="mt-2 text-xs px-3 py-1 rounded"
            style={{ backgroundColor: COLORS.accent, color: COLORS.bg }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Get weak areas from REAL profile data
  const weakAreas = data?.weaknesses || data?.focus_areas || [];
  
  // If no specific weak areas, check readiness scores for low-scoring difficulties
  const lowReadinessDifficulties = [];
  if (weakAreas.length === 0 && data?.readiness_scores) {
    Object.entries(data.readiness_scores).forEach(([diff, score]) => {
      if (score < 0.4) {
        lowReadinessDifficulties.push(`${diff} Problems`);
      }
    });
  }
  
  const displayAreas = weakAreas.length > 0 ? weakAreas : lowReadinessDifficulties;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border p-5"
      style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.border }}
    >
      <h3 className="text-xs font-medium uppercase tracking-widest mb-4" style={{ color: COLORS.textSecondary, fontFamily }}>
        Areas to Improve
      </h3>

      {displayAreas.length === 0 ? (
        <div className="text-center py-4">
          <div className="text-2xl mb-2">✨</div>
          <p className="text-sm" style={{ color: COLORS.textMuted }}>
            Great job! No weak areas detected yet.
          </p>
          <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
            Keep solving problems to build your profile.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayAreas.slice(0, 4).map((area, index) => (
            <motion.div
              key={typeof area === 'string' ? area : area.name || index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center justify-between p-3 rounded-lg border"
              style={{ backgroundColor: `${COLORS.error}10`, borderColor: `${COLORS.error}20` }}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">⚠️</span>
                <div>
                  <span className="text-sm font-medium" style={{ color: COLORS.textPrimary, fontFamily }}>
                    {typeof area === 'string' ? area : area.name || area.topic}
                  </span>
                  <p className="text-xs" style={{ color: COLORS.textMuted }}>
                    Needs more practice
                  </p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handlePractice(typeof area === 'string' ? area : area.name || area.topic)}
                className="px-3 py-1.5 rounded text-xs font-medium"
                style={{ backgroundColor: COLORS.accent, color: COLORS.bg, fontFamily }}
              >
                Practice
              </motion.button>
            </motion.div>
          ))}
        </div>
      )}

      {displayAreas.length > 0 && (
        <div className="mt-4 pt-3 border-t text-xs text-center" style={{ borderColor: COLORS.border, color: COLORS.textMuted }}>
          💡 Focusing on weak areas helps you improve faster
        </div>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export default {
  TopicMasteryGrid,
  NextProblemCard,
  WeakAreaFocus,
  emitAdvancedWidgetsRefresh,
};
