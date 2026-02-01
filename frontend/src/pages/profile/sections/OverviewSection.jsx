/**
 * Overview Section
 *
 * Lightweight section that loads first - contains identity and quick stats.
 * Components: ProfileHeader, StatsOverview, DifficultyProgressBars
 *
 * This section is designed to render quickly and give users immediate feedback.
 */

import { memo } from "react";
import { motion } from "framer-motion";
import ProfileHeader from "../../../components/charts/ProfileHeader";
import StatsOverview from "../../../components/charts/StatsOverview";
import { DifficultyProgressBars } from "../../../components/profile/ProfileWidgets";

// Animation variants
const sectionVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay },
  }),
};

/**
 * Section Header Component - reusable styled header
 */
const SectionHeader = memo(function SectionHeader({
  title,
  gradient = "from-[#D97706]",
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div
        className={`w-1 h-5 bg-gradient-to-b ${gradient} to-transparent rounded-full`}
      ></div>
      <h2
        className="text-[#E8E4D9] text-xs font-medium uppercase tracking-widest"
        style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
      >
        {title}
      </h2>
    </div>
  );
});

/**
 * Profile Header Card - Identity section with actions
 */
const ProfileHeaderCard = memo(function ProfileHeaderCard({
  user,
  onCopyLink,
  onExportPdf,
  exportingPdf,
  actionMessage,
  readOnly,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-5 hover:border-[#D97706]/40 transition-colors"
    >
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={onCopyLink}
          className="px-3 py-1.5 text-xs rounded-md bg-[#1A1814] hover:bg-[#D97706]/10 text-[#E8E4D9] transition-colors"
        >
          Copy link
        </button>
        {!readOnly && (
          <button
            type="button"
            disabled={exportingPdf}
            onClick={onExportPdf}
            className="px-3 py-1.5 text-xs rounded-md bg-[#D97706] hover:bg-[#F59E0B] text-[#0A0A08] font-semibold transition-colors disabled:opacity-60"
          >
            {exportingPdf ? "Exporting…" : "Export PDF"}
          </button>
        )}
        {actionMessage && (
          <span className="text-[10px] text-[#78716C]">{actionMessage}</span>
        )}
      </div>
      <ProfileHeader user={user} />
    </motion.div>
  );
});

/**
 * Performance Stats Section
 */
const PerformanceOverview = memo(function PerformanceOverview({ stats }) {
  return (
    <motion.section
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      custom={0.1}
    >
      <SectionHeader title="Performance Overview" />
      <StatsOverview stats={stats} />
    </motion.section>
  );
});

/**
 * Difficulty Progress Section
 */
const DifficultyProgress = memo(function DifficultyProgress({ overview }) {
  return (
    <motion.section
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      custom={0.2}
    >
      <SectionHeader title="Difficulty Progress" />
      <DifficultyProgressBars
        stats={{
          easySolved: overview?.easySolved || 0,
          easyTotal: overview?.easyTotal || 100,
          mediumSolved: overview?.mediumSolved || 0,
          mediumTotal: overview?.mediumTotal || 200,
          hardSolved: overview?.hardSolved || 0,
          hardTotal: overview?.hardTotal || 100,
        }}
      />
    </motion.section>
  );
});

/**
 * Overview Section - Main Export
 *
 * Props passed from parent:
 * - analytics: Profile analytics data
 * - readOnly: Whether profile is in read-only mode
 * - onCopyLink: Handler for copy link action
 * - onExportPdf: Handler for PDF export action
 * - exportingPdf: Loading state for PDF export
 * - actionMessage: Feedback message for actions
 */
function OverviewSection({
  analytics,
  readOnly = false,
  onCopyLink,
  onExportPdf,
  exportingPdf,
  actionMessage,
}) {
  return (
    <div className="space-y-6">
      {/* Profile Header Card */}
      <ProfileHeaderCard
        user={analytics?.user}
        onCopyLink={onCopyLink}
        onExportPdf={onExportPdf}
        exportingPdf={exportingPdf}
        actionMessage={actionMessage}
        readOnly={readOnly}
      />

      {/* Performance Overview */}
      <PerformanceOverview stats={analytics?.overview} />

      {/* Difficulty Progress */}
      <DifficultyProgress overview={analytics?.overview} />
    </div>
  );
}

export default memo(OverviewSection);
