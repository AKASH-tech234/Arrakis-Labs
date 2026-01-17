// src/pages/profile.jsx - Profile Page
import { motion } from "framer-motion";
import AppHeader from "../components/layout/AppHeader";
import ProfileHeader from "../components/charts/ProfileHeader";
import StatsOverview from "../components/charts/StatsOverview";
import ActivityHeatmap from "../components/charts/ActivityHeatmap";
import CategoryChart from "../components/charts/CategoryChart";
import SubmissionSummary from "../components/charts/SubmissionSummary";

export default function Profile() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A08" }}>
      <AppHeader />

      <main className="pt-14">
        <div className="max-w-4xl mx-auto px-6 lg:px-12 py-12">
          {/* Profile Header */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-12"
          >
            <ProfileHeader />
          </motion.div>

          {/* Stats Overview */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mb-12"
          >
            <h2
              className="text-[#78716C] text-[10px] uppercase tracking-wider mb-4"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Overview
            </h2>
            <StatsOverview />
          </motion.section>

          {/* Activity Heatmap */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mb-12"
          >
            <h2
              className="text-[#78716C] text-[10px] uppercase tracking-wider mb-4"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Activity
            </h2>
            <div className="border border-[#1A1814] p-4">
              <ActivityHeatmap />
            </div>
          </motion.section>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Category Performance */}
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <h2
                className="text-[#78716C] text-[10px] uppercase tracking-wider mb-4"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Categories
              </h2>
              <div className="border border-[#1A1814] p-4">
                <CategoryChart />
              </div>
            </motion.section>

            {/* Recent Submissions */}
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
            >
              <h2
                className="text-[#78716C] text-[10px] uppercase tracking-wider mb-4"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Recent Submissions
              </h2>
              <div className="border border-[#1A1814] p-4">
                <SubmissionSummary />
              </div>
            </motion.section>
          </div>
        </div>
      </main>
    </div>
  );
}
