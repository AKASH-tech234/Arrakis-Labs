// src/pages/profile.jsx - Profile Page
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import AppHeader from "../components/layout/AppHeader";
import ProfileHeader from "../components/charts/ProfileHeader";
import StatsOverview from "../components/charts/StatsOverview";
import ActivityHeatmap from "../components/charts/ActivityHeatmap";
import CategoryChart from "../components/charts/CategoryChart";
import SubmissionSummary from "../components/charts/SubmissionSummary";
import contestApi from "../services/contestApi";

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
  const [contests, setContests] = useState({ live: [], upcoming: [] });
  const [contestsLoading, setContestsLoading] = useState(true);
  const [contestsError, setContestsError] = useState(null);
  const [busy, setBusy] = useState({});

  const setContestBusy = (contestId, value) => {
    setBusy((prev) => ({ ...prev, [contestId]: value }));
  };

  useEffect(() => {
    let cancelled = false;

    const fetchDashboardContests = async () => {
      try {
        setContestsLoading(true);
        setContestsError(null);

        const [liveRes, upcomingRes] = await Promise.all([
          contestApi.getContests({ status: "live", limit: 3 }),
          contestApi.getContests({ status: "upcoming", limit: 5 }),
        ]);

        if (cancelled) return;
        setContests({
          live: liveRes?.data || [],
          upcoming: upcomingRes?.data || [],
        });
      } catch (err) {
        if (cancelled) return;
        setContestsError(err?.message || "Failed to load contests");
      } finally {
        if (!cancelled) setContestsLoading(false);
      }
    };

    fetchDashboardContests();
    return () => {
      cancelled = true;
    };
  }, []);

  const formatDate = useMemo(
    () =>
      (date) =>
        new Intl.DateTimeFormat("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(date)),
    []
  );

  const handleRegister = async (contest) => {
    const contestId = contest?._id;
    if (!contestId) return;

    try {
      setContestBusy(contestId, true);
      await contestApi.registerForContest(contestId);

      // Optimistically reflect registration in the dashboard list
      setContests((prev) => {
        const patchList = (list) =>
          list.map((c) =>
            c._id === contestId
              ? {
                  ...c,
                  registration: {
                    status: "registered",
                    registeredAt: new Date().toISOString(),
                  },
                }
              : c
          );

        return {
          live: patchList(prev.live),
          upcoming: patchList(prev.upcoming),
        };
      });
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || "Failed to register");
    } finally {
      setContestBusy(contestId, false);
    }
  };

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

          {/* Contests - User Dashboard */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mb-16"
          >
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 bg-gradient-to-b from-[#D97706] to-transparent rounded-full"></div>
                <h2
                  className="text-[#E8E4D9] text-sm font-medium uppercase tracking-widest"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  Contests
                </h2>
              </div>
              <Link
                to="/contests"
                className="text-sm text-[#D97706] hover:text-[#F59E0B] transition-colors"
              >
                View all →
              </Link>
            </div>

            <div className="bg-gradient-to-br from-[#1A1814]/50 to-[#0A0A08]/50 backdrop-blur-sm border border-[#D97706]/20 rounded-xl p-6 hover:border-[#D97706]/40 transition-colors">
              {contestsLoading ? (
                <div className="text-[#E8E4D9]/70">Loading contests…</div>
              ) : contestsError ? (
                <div className="text-red-300">{contestsError}</div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Live */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-white font-semibold">Live now</h3>
                      <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-full">
                        LIVE
                      </span>
                    </div>

                    {contests.live.length === 0 ? (
                      <div className="text-[#E8E4D9]/60 text-sm">No live contests right now.</div>
                    ) : (
                      <div className="space-y-3">
                        {contests.live.map((contest) => (
                          <div
                            key={contest._id}
                            className="p-4 rounded-lg border border-white/10 bg-black/20"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-white font-medium">{contest.name}</div>
                                <div className="text-[#E8E4D9]/60 text-xs mt-1">
                                  Ends: {formatDate(contest.endTime)}
                                </div>
                              </div>
                              <Link
                                to={`/contests/${contest.slug || contest._id}`}
                                className="px-3 py-2 text-sm rounded-md bg-[#D97706] hover:bg-[#F59E0B] text-black font-semibold transition-colors"
                              >
                                Enter
                              </Link>
                            </div>
                            {contest.registration && (
                              <div className="mt-2 text-xs text-blue-300">✓ Registered</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Upcoming */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-white font-semibold">Upcoming</h3>
                      <span className="text-xs text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-full">
                        SOON
                      </span>
                    </div>

                    {contests.upcoming.length === 0 ? (
                      <div className="text-[#E8E4D9]/60 text-sm">No upcoming contests.</div>
                    ) : (
                      <div className="space-y-3">
                        {contests.upcoming.map((contest) => {
                          const isRegistered = Boolean(contest.registration);
                          const canRegister = contest.requiresRegistration && !isRegistered;
                          const contestId = contest._id;

                          return (
                            <div
                              key={contestId}
                              className="p-4 rounded-lg border border-white/10 bg-black/20"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-white font-medium">{contest.name}</div>
                                  <div className="text-[#E8E4D9]/60 text-xs mt-1">
                                    Starts: {formatDate(contest.startTime)}
                                  </div>
                                </div>

                                {isRegistered ? (
                                  <span className="px-3 py-2 text-sm rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-300">
                                    Registered
                                  </span>
                                ) : canRegister ? (
                                  <button
                                    type="button"
                                    disabled={Boolean(busy[contestId])}
                                    onClick={() => handleRegister(contest)}
                                    className="px-3 py-2 text-sm rounded-md bg-[#D97706] hover:bg-[#F59E0B] text-black font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                  >
                                    {busy[contestId] ? "Registering…" : "Register"}
                                  </button>
                                ) : (
                                  <Link
                                    to={`/contests/${contest.slug || contest._id}`}
                                    className="px-3 py-2 text-sm rounded-md bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors"
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
