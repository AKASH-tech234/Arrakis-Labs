/**
 * Analytics Section
 *
 * Data-heavy section containing charts, submissions, and activity data.
 * Components: ActivityHeatmap, CategoryChart, SubmissionSummary, Contests
 *
 * This section contains heavier visualizations and is lazy-loaded.
 */

import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import ActivityHeatmap from "../../../components/charts/ActivityHeatmap";
import CategoryChart from "../../../components/charts/CategoryChart";
import SubmissionSummary from "../../../components/charts/SubmissionSummary";

// Animation variants
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

const sectionVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay },
  }),
};

/**
 * Section Header Component
 */
const SectionHeader = memo(function SectionHeader({
  title,
  gradient = "from-[#D97706]",
  extra,
}) {
  return (
    <div className="flex items-center justify-between gap-2 mb-4">
      <div className="flex items-center gap-2">
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
      {extra}
    </div>
  );
});

/**
 * Activity Calendar Section
 */
const ActivityCalendar = memo(function ActivityCalendar({ activity }) {
  return (
    <motion.section
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      custom={0.1}
    >
      <SectionHeader title="Activity Calendar" />
      <div className="rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-4 hover:border-[#D97706]/40 transition-colors">
        <ActivityHeatmap activity={activity} />
      </div>
    </motion.section>
  );
});

/**
 * Category & Submissions Grid
 */
const CategorySubmissionsGrid = memo(function CategorySubmissionsGrid({
  categories,
  submissions,
}) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 md:grid-cols-2 gap-4"
    >
      {/* Category Breakdown */}
      <motion.section variants={itemVariants}>
        <SectionHeader title="Category Breakdown" gradient="from-[#F59E0B]" />
        <div className="rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-4 hover:border-[#D97706]/40 transition-colors">
          <CategoryChart categories={categories} />
        </div>
      </motion.section>

      {/* Recent Submissions */}
      <motion.section variants={itemVariants}>
        <SectionHeader title="Recent Submissions" gradient="from-[#F59E0B]" />
        <div className="rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-4 hover:border-[#D97706]/40 transition-colors">
          <SubmissionSummary submissions={submissions} />
        </div>
      </motion.section>
    </motion.div>
  );
});

/**
 * Contests Section
 */
const ContestsPanel = memo(function ContestsPanel({
  contests,
  contestsLoading,
  contestsError,
  formatDate,
  onRegister,
  busy,
  readOnly,
}) {
  return (
    <motion.section
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      custom={0.2}
    >
      <SectionHeader
        title="Contests"
        extra={
          <Link
            to="/contests"
            className="text-xs text-[#D97706] hover:text-[#F59E0B] transition-colors"
          >
            View all →
          </Link>
        }
      />

      <div className="rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-4 hover:border-[#D97706]/40 transition-colors">
        {contestsLoading ? (
          <div className="text-[#78716C] text-sm">Loading contests…</div>
        ) : contestsError ? (
          <div className="text-red-400 text-sm">{contestsError}</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Live Contests */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[#E8E4D9] text-sm font-semibold">
                  Live now
                </h3>
                <span className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded">
                  LIVE
                </span>
              </div>

              {contests.live.length === 0 ? (
                <div className="text-[#78716C] text-xs">
                  No live contests right now.
                </div>
              ) : (
                <div className="space-y-2">
                  {contests.live.map((contest) => (
                    <div
                      key={contest._id}
                      className="p-3 rounded-lg border border-[#1A1814] bg-[#0A0A08]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[#E8E4D9] text-sm font-medium">
                            {contest.name}
                          </div>
                          <div className="text-[#78716C] text-[10px] mt-0.5">
                            Ends: {formatDate(contest.endTime)}
                          </div>
                        </div>
                        <Link
                          to={`/contests/${contest.slug || contest._id}`}
                          className="px-2.5 py-1.5 text-xs rounded-md bg-[#D97706] hover:bg-[#F59E0B] text-[#0A0A08] font-semibold transition-colors"
                        >
                          Enter
                        </Link>
                      </div>
                      {contest.registration && (
                        <div className="mt-1.5 text-[10px] text-blue-300">
                          ✓ Registered
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upcoming Contests */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[#E8E4D9] text-sm font-semibold">
                  Upcoming
                </h3>
                <span className="text-[10px] text-blue-300 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">
                  SOON
                </span>
              </div>

              {contests.upcoming.length === 0 ? (
                <div className="text-[#78716C] text-xs">
                  No upcoming contests.
                </div>
              ) : (
                <div className="space-y-2">
                  {contests.upcoming.map((contest) => {
                    const isRegistered = Boolean(contest.registration);
                    const canRegister =
                      contest.requiresRegistration && !isRegistered;
                    const contestId = contest._id;

                    return (
                      <div
                        key={contestId}
                        className="p-3 rounded-lg border border-[#1A1814] bg-[#0A0A08]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-[#E8E4D9] text-sm font-medium">
                              {contest.name}
                            </div>
                            <div className="text-[#78716C] text-[10px] mt-0.5">
                              Starts: {formatDate(contest.startTime)}
                            </div>
                          </div>

                          {isRegistered ? (
                            <span className="px-2 py-1 text-[10px] rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-300">
                              Registered
                            </span>
                          ) : canRegister ? (
                            <button
                              type="button"
                              disabled={readOnly || Boolean(busy[contestId])}
                              onClick={
                                readOnly ? undefined : () => onRegister(contest)
                              }
                              className="px-2.5 py-1.5 text-xs rounded-md bg-[#D97706] hover:bg-[#F59E0B] text-[#0A0A08] font-semibold transition-colors disabled:opacity-60"
                            >
                              {busy[contestId] ? "Registering…" : "Register"}
                            </button>
                          ) : (
                            <Link
                              to={`/contests/${contest.slug || contest._id}`}
                              className="px-2 py-1 text-[10px] rounded-md bg-[#1A1814] hover:bg-[#D97706]/10 text-[#E8E4D9] transition-colors"
                            >
                              Details
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
});

/**
 * Analytics Section - Main Export
 *
 * Props:
 * - analytics: Profile analytics data
 * - contests: Contest data { live: [], upcoming: [] }
 * - contestsLoading: Loading state for contests
 * - contestsError: Error message for contests
 * - formatDate: Date formatter function
 * - onRegister: Handler for contest registration
 * - busy: Busy state object for contests
 * - readOnly: Whether profile is read-only
 */
function AnalyticsSection({
  analytics,
  contests,
  contestsLoading,
  contestsError,
  formatDate,
  onRegister,
  busy,
  readOnly,
}) {
  return (
    <div className="space-y-6">
      {/* Activity Calendar */}
      <ActivityCalendar activity={analytics?.activity} />

      {/* Category & Submissions */}
      <CategorySubmissionsGrid
        categories={analytics?.categories}
        submissions={analytics?.recentSubmissions}
      />

      {/* Contests */}
      <ContestsPanel
        contests={contests}
        contestsLoading={contestsLoading}
        contestsError={contestsError}
        formatDate={formatDate}
        onRegister={onRegister}
        busy={busy}
        readOnly={readOnly}
      />
    </div>
  );
}

export default memo(AnalyticsSection);
