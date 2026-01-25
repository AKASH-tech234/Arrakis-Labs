

import { motion } from "framer-motion";

const StatCard = ({ label, value, unit, accent, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    className={`group relative overflow-hidden rounded-lg bg-gradient-to-br from-[#1A1814]/60 to-[#0A0A08]/60 backdrop-blur-sm border border-[#D97706]/20 p-6 hover:border-[#D97706]/50 hover:shadow-lg hover:shadow-[#D97706]/15 transition-all duration-300`}
  >
    {}
    <div className="absolute inset-0 bg-gradient-to-r from-[#D97706]/0 via-[#D97706]/5 to-[#92400E]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

    {}
    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#D97706] via-[#F59E0B] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

    <div className="relative z-10">
      <p
        className="text-[#78716C] group-hover:text-[#D97706] text-[10px] uppercase tracking-wider mb-3 transition-colors duration-300 font-medium"
        style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
      >
        {label}
      </p>
      <motion.p
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.4, delay: delay + 0.1 }}
        className={`text-3xl font-bold group-hover:text-[#FCD34D] transition-colors duration-300 ${accent}`}
        style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
      >
        {value}
        {unit && <span className="text-[#3D3D3D] group-hover:text-[#78716C] text-lg ml-1 transition-colors">{unit}</span>}
      </motion.p>
    </div>
  </motion.div>
);

export default function StatsOverview({ stats }) {
  const s = stats || {};
  const problemsSolved = Number(s.problemsSolved) || 0;
  const totalProblems = Number(s.totalProblems) || 0;
  const acceptanceRate = Number.isFinite(s.acceptanceRate) ? s.acceptanceRate : Number(s.acceptanceRate) || 0;
  const currentStreak = Number(s.currentStreak) || 0;
  const maxStreak = Number(s.maxStreak) || 0;
  const easyCount = Number(s.easyCount) || 0;
  const mediumCount = Number(s.mediumCount) || 0;
  const hardCount = Number(s.hardCount) || 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {}
      <StatCard
        label="Solved"
        value={problemsSolved}
        unit={`/${totalProblems}`}
        accent="text-[#E8E4D9]"
        delay={0}
      />

      {}
      <StatCard
        label="Acceptance"
        value={acceptanceRate}
        unit="%"
        accent="text-[#E8E4D9]"
        delay={0.1}
      />

      {}
      <StatCard
        label="Current Streak"
        value={currentStreak}
        unit="days"
        accent="text-[#F59E0B]"
        delay={0.2}
      />

      {}
      <StatCard
        label="Best Streak"
        value={maxStreak}
        unit="days"
        accent="text-[#D97706]"
        delay={0.3}
      />

      {}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="col-span-2 md:col-span-4 group relative overflow-hidden rounded-lg bg-gradient-to-br from-[#1A1814]/60 to-[#0A0A08]/60 backdrop-blur-sm border border-[#D97706]/20 p-6 hover:border-[#D97706]/50 hover:shadow-lg hover:shadow-[#D97706]/15 transition-all duration-300"
      >
        {}
        <div className="absolute inset-0 bg-gradient-to-r from-[#D97706]/0 via-[#D97706]/5 to-[#92400E]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

        {}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#D97706] via-[#F59E0B] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

        <div className="relative z-10">
          <p
            className="text-[#78716C] group-hover:text-[#D97706] text-[10px] uppercase tracking-wider mb-5 transition-colors duration-300 font-medium"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Difficulty Breakdown
          </p>
          <div className="flex items-center gap-8 flex-wrap">
            {}
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-3"
            >
              <span
                className="text-[#78716C] group-hover:text-[#E8E4D9] text-xs uppercase tracking-wider transition-colors duration-300 font-medium"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Easy
              </span>
              <span
                className="text-[#E8E4D9] group-hover:text-[#F59E0B] text-lg font-bold transition-colors duration-300"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                {easyCount}
              </span>
            </motion.div>

            {}
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-3"
            >
              <span
                className="text-[#D97706] group-hover:text-[#FCD34D] text-xs uppercase tracking-wider transition-colors duration-300 font-medium"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Medium
              </span>
              <span
                className="text-[#E8E4D9] group-hover:text-[#F59E0B] text-lg font-bold transition-colors duration-300"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                {mediumCount}
              </span>
            </motion.div>

            {}
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-3"
            >
              <span
                className="text-[#92400E] group-hover:text-[#F59E0B] text-xs uppercase tracking-wider transition-colors duration-300 font-medium"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Hard
              </span>
              <span
                className="text-[#E8E4D9] group-hover:text-[#F59E0B] text-lg font-bold transition-colors duration-300"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                {hardCount}
              </span>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
