import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { getMIMProfile, getMIMRecommendations } from "../../services/ai/aiApi";

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

const MASTERY_LEVELS = [
  { name: "Novice", min: 0, max: 0.2, color: "#78716C" },
  { name: "Beginner", min: 0.2, max: 0.4, color: "#EF4444" },
  { name: "Intermediate", min: 0.4, max: 0.6, color: "#F59E0B" },
  { name: "Advanced", min: 0.6, max: 0.8, color: "#22C55E" },
  { name: "Expert", min: 0.8, max: 1.0, color: "#3B82F6" },
];

function getMasteryLevel(score) {
  for (const level of MASTERY_LEVELS) {
    if (score >= level.min && score < level.max) {
      return level;
    }
  }
  return MASTERY_LEVELS[MASTERY_LEVELS.length - 1];
}

export function TopicMasteryGrid({ userId, showLevels = true }) {
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

  const buildTopicMastery = () => {
    if (!data) return [];

    const topics = [];

    const topicSuccessRates = data.topic_success_rates || {};
    Object.entries(topicSuccessRates).forEach(([topic, rate]) => {
      const numericRate = typeof rate === 'number' ? rate : parseFloat(rate) || 0;
      const level = getMasteryLevel(numericRate);
      topics.push({
        name: topic,
        mastery: numericRate,
        level: level.name,
        levelColor: level.color,
        problemsSolved: null,
        isTopicBased: true
      });
    });

    const categoryPerf = data.category_performance || data.learning_trajectory?.category_performance || {};
    Object.entries(categoryPerf).forEach(([cat, perf]) => {

      if (topics.some(t => t.name.toLowerCase() === cat.toLowerCase())) return;

      let rate, total, passed;
      if (typeof perf === 'object') {
        total = perf.total || 0;
        passed = perf.passed || 0;
        rate = total > 0 ? passed / total : 0;
      } else {
        rate = perf;
        total = null;
        passed = null;
      }

      const level = getMasteryLevel(rate);
      topics.push({
        name: cat,
        mastery: rate,
        level: level.name,
        levelColor: level.color,
        problemsSolved: passed,
        totalProblems: total,
        isTopicBased: true
      });
    });

    if (topics.length === 0) {
      const readiness = data.readiness_scores || {};
      Object.entries(readiness).forEach(([diff, score]) => {
        const numericScore = typeof score === 'number' ? score : parseFloat(score) || 0;
        const level = getMasteryLevel(numericScore);
        topics.push({
          name: `${diff} Problems`,
          mastery: numericScore,
          level: level.name,
          levelColor: level.color,
          isTopicBased: false
        });
      });
    }

    topics.sort((a, b) => b.mastery - a.mastery);

    return topics.slice(0, 12);
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
      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-xs font-medium uppercase tracking-widest"
          style={{ color: COLORS.textSecondary, fontFamily }}
        >
          Topic Mastery
        </h3>
        {showLevels && (
          <div className="flex items-center gap-1">
            {MASTERY_LEVELS.map((level) => (
              <div
                key={level.name}
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: level.color }}
                title={level.name}
              />
            ))}
          </div>
        )}
      </div>

      {topics.length === 0 ? (
        <div className="text-center py-6">
          <div className="text-3xl mb-2">📊</div>
          <p className="text-sm" style={{ color: COLORS.textMuted }}>
            Solve more problems to see your topic mastery.
          </p>
          <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
            Your skills will be tracked across different topics.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {topics.map((topic, index) => (
            <TopicMasteryRow key={topic.name} topic={topic} index={index} showLevel={showLevels} />
          ))}
        </div>
      )}

      {}
      {topics.length > 0 && showLevels && (
        <div className="mt-4 pt-3 border-t flex flex-wrap gap-3" style={{ borderColor: COLORS.border }}>
          {MASTERY_LEVELS.map((level) => (
            <div key={level.name} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: level.color }} />
              <span className="text-[10px]" style={{ color: COLORS.textMuted }}>{level.name}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function TopicMasteryRow({ topic, index, showLevel }) {
  const percentage = Math.round(topic.mastery * 100);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group"
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-medium"
            style={{ color: COLORS.textPrimary, fontFamily }}
          >
            {topic.name}
          </span>
          {showLevel && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider"
              style={{
                backgroundColor: `${topic.levelColor}20`,
                color: topic.levelColor,
                fontFamily
              }}
            >
              {topic.level}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {topic.problemsSolved !== null && topic.totalProblems !== null && (
            <span className="text-[10px]" style={{ color: COLORS.textMuted }}>
              {topic.problemsSolved}/{topic.totalProblems}
            </span>
          )}
          <span className="text-xs font-bold" style={{ color: topic.levelColor }}>
            {percentage}%
          </span>
        </div>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ backgroundColor: COLORS.border }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.6, delay: index * 0.05, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ backgroundColor: topic.levelColor }}
        />
      </div>
    </motion.div>
  );
}

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
      const data = await getMIMRecommendations({ userId, limit: 3 });
      console.log("[NextProblemCard] Response:", data);

      if (data && data.recommendations && data.recommendations.length > 0) {

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
      {}
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

  const weakAreas = data?.weaknesses || data?.focus_areas || [];

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

export default {
  TopicMasteryGrid,
  NextProblemCard,
  WeakAreaFocus,
  emitAdvancedWidgetsRefresh,
};
