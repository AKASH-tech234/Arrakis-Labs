// src/pages/profile.jsx - Profile Page
import { motion } from "framer-motion";
import AppHeader from "../components/layout/AppHeader";
import ProfileHeader from "../components/charts/ProfileHeader";
import StatsOverview from "../components/charts/StatsOverview";
import ActivityHeatmap from "../components/charts/ActivityHeatmap";
import CategoryChart from "../components/charts/CategoryChart";
import SubmissionSummary from "../components/charts/SubmissionSummary";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

export default function Profile() {
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: "#0A0A08" }}>
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Top right glow */}
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#D97706]/5 rounded-full blur-3xl"></div>
        {/* Bottom left glow */}
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#92400E]/5 rounded-full blur-3xl"></div>
        {/* Center accent */}
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-[#D97706]/3 rounded-full blur-3xl"></div>
      </div>

      {/* Grid Pattern Overlay */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 opacity-5"
        style={{
          backgroundImage: `linear-gradient(to right, #D97706 1px, transparent 1px), linear-gradient(to bottom, #D97706 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}
      ></div>

      <AppHeader />

      <main className="pt-20 relative z-10">
        <div className="max-w-5xl mx-auto px-6 lg:px-12 py-12">
          {/* Profile Header - Enhanced */}
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="mb-16 bg-gradient-to-br from-[#1A1814]/50 to-[#0A0A08]/50 backdrop-blur-sm border border-[#D97706]/20 rounded-xl p-8 hover:border-[#D97706]/40 transition-colors"
          >
            <div className="relative z-10">
              <ProfileHeader />
            </div>
            {/* Hover glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#D97706]/0 via-[#D97706]/5 to-[#92400E]/0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </motion.div>

          {/* Stats Overview - Enhanced */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-16"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-6 bg-gradient-to-b from-[#D97706] to-transparent rounded-full"></div>
              <h2
                className="text-[#E8E4D9] text-sm font-medium uppercase tracking-widest"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Performance Overview
              </h2>
            </div>
            <StatsOverview />
          </motion.section>

          {/* Activity Heatmap - Enhanced */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mb-16"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-6 bg-gradient-to-b from-[#D97706] to-transparent rounded-full"></div>
              <h2
                className="text-[#E8E4D9] text-sm font-medium uppercase tracking-widest"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Activity Calendar
              </h2>
            </div>
            <div className="bg-gradient-to-br from-[#1A1814]/50 to-[#0A0A08]/50 backdrop-blur-sm border border-[#D97706]/20 rounded-xl p-6 hover:border-[#D97706]/40 hover:shadow-lg hover:shadow-[#D97706]/10 transition-all duration-300">
              <ActivityHeatmap />
            </div>
          </motion.section>

          {/* Two Column Layout - Enhanced */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            {/* Category Performance */}
            <motion.section variants={itemVariants}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-6 bg-gradient-to-b from-[#F59E0B] to-transparent rounded-full"></div>
                <h2
                  className="text-[#E8E4D9] text-sm font-medium uppercase tracking-widest"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  Category Breakdown
                </h2>
              </div>
              <div className="bg-gradient-to-br from-[#1A1814]/50 to-[#0A0A08]/50 backdrop-blur-sm border border-[#D97706]/20 rounded-xl p-6 hover:border-[#D97706]/40 hover:shadow-lg hover:shadow-[#D97706]/10 transition-all duration-300 group">
                <div className="absolute inset-0 bg-gradient-to-r from-[#D97706]/0 via-[#D97706]/3 to-[#92400E]/0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative z-10">
                  <CategoryChart />
                </div>
              </div>
            </motion.section>

            {/* Recent Submissions */}
            <motion.section variants={itemVariants}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-6 bg-gradient-to-b from-[#F59E0B] to-transparent rounded-full"></div>
                <h2
                  className="text-[#E8E4D9] text-sm font-medium uppercase tracking-widest"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  Recent Submissions
                </h2>
              </div>
              <div className="bg-gradient-to-br from-[#1A1814]/50 to-[#0A0A08]/50 backdrop-blur-sm border border-[#D97706]/20 rounded-xl p-6 hover:border-[#D97706]/40 hover:shadow-lg hover:shadow-[#D97706]/10 transition-all duration-300 group">
                <div className="absolute inset-0 bg-gradient-to-r from-[#D97706]/0 via-[#D97706]/3 to-[#92400E]/0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative z-10">
                  <SubmissionSummary />
                </div>
              </div>
            </motion.section>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
