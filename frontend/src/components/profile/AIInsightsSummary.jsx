// ═══════════════════════════════════════════════════════════════════════════════
// AI INSIGHTS SUMMARY
// Comprehensive dashboard showing ALL MIM and Agent outputs
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getMIMProfile } from "../../services/ai/aiApi";

const COLORS = {
  bgCard: "#0F0F0D",
  bgCardHover: "#141410",
  border: "#1A1814",
  textPrimary: "#E8E4D9",
  textSecondary: "#A8A29E",
  textMuted: "#78716C",
  accent: "#D97706",
  success: "#22C55E",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",
  purple: "#8B5CF6",
};

const fontFamily = "'Rajdhani', system-ui, sans-serif";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 100, damping: 15 }
  }
};

const pulseAnimation = {
  scale: [1, 1.05, 1],
  transition: { duration: 2, repeat: Infinity, ease: "easeInOut" }
};

// ═══════════════════════════════════════════════════════════════════════════════
// INSIGHT CARDS
// ═══════════════════════════════════════════════════════════════════════════════

function InsightCard({ title, icon, value, subtitle, color, trend, children }) {
  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ scale: 1.02, y: -2 }}
      className="rounded-xl border p-4 relative overflow-hidden group"
      style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.border }}
    >
      {/* Background glow */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ 
          background: `radial-gradient(circle at 50% 50%, ${color}10 0%, transparent 70%)`
        }}
      />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xl">{icon}</span>
          {trend && (
            <motion.span 
              className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-medium"
              style={{ 
                backgroundColor: `${trend === 'up' ? COLORS.success : trend === 'down' ? COLORS.error : COLORS.textMuted}20`,
                color: trend === 'up' ? COLORS.success : trend === 'down' ? COLORS.error : COLORS.textMuted
              }}
              animate={trend === 'up' ? pulseAnimation : {}}
            >
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trend}
            </motion.span>
          )}
        </div>
        
        <h4 
          className="text-[10px] uppercase tracking-wider mb-1"
          style={{ color: COLORS.textMuted, fontFamily }}
        >
          {title}
        </h4>
        
        {value && (
          <motion.div 
            className="text-2xl font-bold mb-1"
            style={{ color, fontFamily }}
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            {value}
          </motion.div>
        )}
        
        {subtitle && (
          <p className="text-xs" style={{ color: COLORS.textSecondary }}>
            {subtitle}
          </p>
        )}
        
        {children}
      </div>
    </motion.div>
  );
}

function ProgressBar({ value, max = 100, color, label, showPercentage = true }) {
  const percentage = Math.min((value / max) * 100, 100);
  
  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between text-[10px]">
          <span style={{ color: COLORS.textMuted }}>{label}</span>
          {showPercentage && (
            <span style={{ color }}>{Math.round(percentage)}%</span>
          )}
        </div>
      )}
      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: COLORS.border }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function AIInsightsSummary({ userId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

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

  if (loading) {
    return (
      <div className="rounded-xl border p-6" style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.border }}>
        <div className="flex items-center justify-center py-8">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="w-6 h-6 border-2 border-t-transparent rounded-full"
            style={{ borderColor: COLORS.accent, borderTopColor: 'transparent' }}
          />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border p-6" style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.border }}>
        <div className="text-center py-6">
          <div className="text-3xl mb-2">🤖</div>
          <p className="text-sm" style={{ color: COLORS.textMuted }}>
            AI insights will appear here after you solve problems.
          </p>
        </div>
      </div>
    );
  }

  // Extract all data
  const {
    skill_level,
    learning_velocity,
    strengths = [],
    weaknesses = [],
    readiness_scores = {},
    learning_trajectory = {},
    mistake_analysis = {},
    focus_areas = [],
    recent_learning = [],
    recent_difficulty_actions = [],
    last_mim = {},
    topic_success_rates = {},
    category_performance = {},
  } = data;

  const totalSubmissions = learning_trajectory.total_submissions || 0;
  const successRate = learning_trajectory.success_rate || 0;
  const totalMistakes = mistake_analysis.total_mistakes || 0;
  const topMistakes = mistake_analysis.top_mistakes || [];
  const patterns = mistake_analysis.recurring_patterns || [];

  // Velocity to trend mapping
  const velocityTrend = {
    accelerating: 'up',
    stable: 'stable',
    decelerating: 'down',
    stalled: 'down'
  }[learning_velocity] || 'stable';

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'skills', label: 'Skills', icon: '🎯' },
    { id: 'mim', label: 'MIM', icon: '🧠' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.border }}
    >
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: COLORS.border }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div 
              className="text-2xl"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              🤖
            </motion.div>
            <div>
              <h3 
                className="text-sm font-medium"
                style={{ color: COLORS.textPrimary, fontFamily }}
              >
                AI Insights Dashboard
              </h3>
              <p className="text-[10px]" style={{ color: COLORS.textMuted }}>
                Powered by MIM v3.3 • {totalSubmissions} submissions analyzed
              </p>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-1 bg-[#1A1814] rounded-lg p-1">
            {tabs.map(tab => (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="px-3 py-1.5 rounded-md text-xs transition-colors"
                style={{
                  backgroundColor: activeTab === tab.id ? COLORS.accent : 'transparent',
                  color: activeTab === tab.id ? COLORS.bgCard : COLORS.textMuted,
                  fontFamily
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="mr-1">{tab.icon}</span>
                {tab.label}
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-3"
            >
              <InsightCard
                title="Skill Level"
                icon="🎖️"
                value={skill_level}
                subtitle="Current assessment"
                color={COLORS.accent}
              />
              
              <InsightCard
                title="Learning Velocity"
                icon="🚀"
                value={learning_velocity}
                subtitle={learning_trajectory.trend || "Building profile"}
                color={velocityTrend === 'up' ? COLORS.success : velocityTrend === 'down' ? COLORS.warning : COLORS.info}
                trend={velocityTrend}
              />
              
              <InsightCard
                title="Success Rate"
                icon="✅"
                value={`${Math.round(successRate)}%`}
                subtitle={`${learning_trajectory.total_correct || 0} / ${totalSubmissions}`}
                color={successRate >= 60 ? COLORS.success : successRate >= 40 ? COLORS.warning : COLORS.error}
              />
              
              <InsightCard
                title="Mistakes Tracked"
                icon="🔍"
                value={totalMistakes}
                subtitle={`${topMistakes.length} unique types`}
                color={COLORS.error}
              />
            </motion.div>
          )}

          {activeTab === 'skills' && (
            <motion.div
              key="skills"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Readiness Scores */}
              <motion.div variants={itemVariants} className="space-y-3">
                <h4 className="text-xs font-medium uppercase tracking-wider" style={{ color: COLORS.textSecondary }}>
                  Difficulty Readiness
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  {Object.entries(readiness_scores).map(([diff, score]) => (
                    <div key={diff} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs" style={{ color: COLORS.textPrimary }}>{diff}</span>
                        <span 
                          className="text-xs font-bold"
                          style={{ color: score >= 0.6 ? COLORS.success : score >= 0.4 ? COLORS.warning : COLORS.textMuted }}
                        >
                          {Math.round(score * 100)}%
                        </span>
                      </div>
                      <ProgressBar 
                        value={score * 100} 
                        color={score >= 0.6 ? COLORS.success : score >= 0.4 ? COLORS.warning : COLORS.textMuted}
                        showPercentage={false}
                      />
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Strengths & Weaknesses */}
              <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: COLORS.success }}>
                    ✅ Strengths
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {strengths.length > 0 ? strengths.map((s, i) => (
                      <motion.span
                        key={s}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="text-xs px-2 py-1 rounded-lg"
                        style={{ backgroundColor: `${COLORS.success}20`, color: COLORS.success }}
                      >
                        {s}
                      </motion.span>
                    )) : (
                      <span className="text-xs" style={{ color: COLORS.textMuted }}>Keep practicing!</span>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: COLORS.warning }}>
                    ⚠️ Focus Areas
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {(weaknesses.length > 0 ? weaknesses : focus_areas).slice(0, 5).map((w, i) => (
                      <motion.span
                        key={w}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="text-xs px-2 py-1 rounded-lg"
                        style={{ backgroundColor: `${COLORS.warning}20`, color: COLORS.warning }}
                      >
                        {w}
                      </motion.span>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Topic Success Rates */}
              {Object.keys(topic_success_rates).length > 0 && (
                <motion.div variants={itemVariants}>
                  <h4 className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: COLORS.textSecondary }}>
                    Topic Performance
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(topic_success_rates)
                      .sort(([,a], [,b]) => b - a)
                      .slice(0, 6)
                      .map(([topic, rate], i) => (
                        <motion.div
                          key={topic}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                        >
                          <ProgressBar
                            value={rate * 100}
                            color={rate >= 0.6 ? COLORS.success : rate >= 0.4 ? COLORS.warning : COLORS.error}
                            label={topic}
                          />
                        </motion.div>
                      ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {activeTab === 'mim' && (
            <motion.div
              key="mim"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Last MIM Decision */}
              {last_mim?.root_cause && (
                <motion.div 
                  variants={itemVariants}
                  className="p-3 rounded-lg border"
                  style={{ backgroundColor: `${COLORS.purple}10`, borderColor: `${COLORS.purple}30` }}
                >
                  <h4 className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: COLORS.purple }}>
                    🧠 Last MIM Decision
                  </h4>
                  <div className="flex items-center gap-3">
                    <span 
                      className="text-sm px-2 py-1 rounded"
                      style={{ backgroundColor: `${COLORS.purple}20`, color: COLORS.textPrimary }}
                    >
                      {last_mim.root_cause?.replace(/_/g, ' ')}
                    </span>
                    {last_mim.confidence && (
                      <span className="text-xs" style={{ color: COLORS.textMuted }}>
                        {Math.round(last_mim.confidence * 100)}% confidence
                      </span>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Top Mistakes from MIM */}
              {topMistakes.length > 0 && (
                <motion.div variants={itemVariants}>
                  <h4 className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: COLORS.error }}>
                    🔍 Top Diagnosed Issues
                  </h4>
                  <div className="space-y-2">
                    {topMistakes.slice(0, 5).map((mistake, i) => {
                      const cause = typeof mistake === 'object' ? mistake.cause : mistake;
                      const count = typeof mistake === 'object' ? mistake.count : 1;
                      return (
                        <motion.div
                          key={cause}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex items-center justify-between p-2 rounded-lg"
                          style={{ backgroundColor: `${COLORS.error}10` }}
                        >
                          <span className="text-sm" style={{ color: COLORS.textPrimary }}>
                            {cause?.replace(/_/g, ' ')}
                          </span>
                          <span 
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: `${COLORS.error}20`, color: COLORS.error }}
                          >
                            {count}×
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Recurring Patterns */}
              {patterns.length > 0 && (
                <motion.div variants={itemVariants}>
                  <h4 className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: COLORS.warning }}>
                    🔄 Recurring Patterns
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {patterns.slice(0, 5).map((pattern, i) => {
                      const name = typeof pattern === 'object' ? pattern.pattern : pattern;
                      const count = typeof pattern === 'object' ? pattern.count : 1;
                      return (
                        <motion.span
                          key={name}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.1 }}
                          className="text-xs px-2.5 py-1.5 rounded-lg border inline-flex items-center gap-1.5"
                          style={{ 
                            backgroundColor: `${COLORS.warning}10`,
                            borderColor: `${COLORS.warning}30`,
                            color: COLORS.warning
                          }}
                        >
                          {name?.replace(/_/g, ' ')}
                          {count > 1 && (
                            <span className="text-[10px] px-1 rounded-full" style={{ backgroundColor: `${COLORS.warning}20` }}>
                              {count}×
                            </span>
                          )}
                        </motion.span>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Recent Learning Recommendations */}
              {recent_learning.length > 0 && (
                <motion.div variants={itemVariants}>
                  <h4 className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: COLORS.info }}>
                    💡 AI Recommendations
                  </h4>
                  <div className="space-y-2">
                    {recent_learning.map((rec, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="p-2 rounded-lg text-xs"
                        style={{ backgroundColor: `${COLORS.info}10`, color: COLORS.textSecondary }}
                      >
                        {typeof rec === 'string' ? rec : rec.summary || rec.rationale}
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Recent Difficulty Actions */}
              {recent_difficulty_actions.length > 0 && (
                <motion.div variants={itemVariants}>
                  <h4 className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: COLORS.accent }}>
                    📊 Difficulty Adjustments
                  </h4>
                  <div className="space-y-2">
                    {recent_difficulty_actions.map((action, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-center gap-2 p-2 rounded-lg"
                        style={{ backgroundColor: `${COLORS.accent}10` }}
                      >
                        <span className="text-sm">
                          {action.action === 'increase' ? '📈' : action.action === 'decrease' ? '📉' : '➡️'}
                        </span>
                        <span className="text-xs" style={{ color: COLORS.textSecondary }}>
                          {action.reason?.replace(/_/g, ' ')}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
