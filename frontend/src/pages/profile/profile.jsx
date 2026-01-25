import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import AppHeader from "../../components/layout/AppHeader";
import ProfileHeader from "../../components/charts/ProfileHeader";
import StatsOverview from "../../components/charts/StatsOverview";
import ActivityHeatmap from "../../components/charts/ActivityHeatmap";
import CategoryChart from "../../components/charts/CategoryChart";
import SubmissionSummary from "../../components/charts/SubmissionSummary";
import contestApi from "../../services/contest/contestApi";
import apiClient from "../../services/common/api";
import useProfileAnalytics from "../../hooks/profile/useProfileAnalytics";
import {
  CognitiveProfile,
  ProblemRecommendations,
  LearningRoadmap,
} from "../../components/mim";

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

export default function Profile({ username, readOnly = false } = {}) {
  const [contests, setContests] = useState({ live: [], upcoming: [] });
  const [contestsLoading, setContestsLoading] = useState(true);
  const [contestsError, setContestsError] = useState(null);
  const [busy, setBusy] = useState({});
  const [actionMessage, setActionMessage] = useState(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const { data: analytics } = useProfileAnalytics({ username });

  // Debug: Log analytics data to see user._id
  useEffect(() => {
    console.log("[Profile] Analytics data:", analytics);
    console.log("[Profile] User ID:", analytics?.user?._id);
  }, [analytics]);

  const clearActionMessageSoon = () => {
    window.setTimeout(() => setActionMessage(null), 2000);
  };

  const handleCopyProfileLink = async () => {
    const publicUsername =
      analytics?.publicSettings?.publicUsername || analytics?.user?.username;
    const url =
      readOnly || !publicUsername
        ? window.location.href
        : `${window.location.origin}/u/${encodeURIComponent(publicUsername)}`;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        window.prompt("Copy profile link:", url);
      }
      setActionMessage("Link copied");
      clearActionMessageSoon();
    } catch {
      window.prompt("Copy profile link:", url);
    }
  };

  const handleExportPdf = async () => {
    if (readOnly) return;
    try {
      setExportingPdf(true);
      const res = await apiClient.post("/export/pdf", {
        format: "one_page",
        includeQr: true,
      });
      const fileUrl = res?.data?.data?.fileUrl;

      if (!fileUrl) throw new Error("PDF export did not return a file URL");

      const apiBase = String(apiClient?.defaults?.baseURL || "");
      const origin = apiBase.replace(/\/?api\/?$/, "");
      const absoluteUrl = `${origin}${fileUrl}`;
      window.open(absoluteUrl, "_blank", "noopener,noreferrer");

      setActionMessage("PDF generated");
      clearActionMessageSoon();
    } catch (err) {
      alert(
        err?.response?.data?.message || err?.message || "Failed to export PDF",
      );
    } finally {
      setExportingPdf(false);
    }
  };

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
    () => (date) =>
      new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(date)),
    [],
  );

  const handleRegister = async (contest) => {
    if (readOnly) return;

    const contestId = contest?._id;
    if (!contestId) return;

    try {
      setContestBusy(contestId, true);
      await contestApi.registerForContest(contestId);

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
              : c,
          );

        return {
          live: patchList(prev.live),
          upcoming: patchList(prev.upcoming),
        };
      });
    } catch (err) {
      alert(
        err?.response?.data?.message || err?.message || "Failed to register",
      );
    } finally {
      setContestBusy(contestId, false);
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#0A0A08" }}
    >
      <AppHeader />

      <main className="pt-16">
        <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6 space-y-6">
          {/* Profile Header Card */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="relative rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-5 hover:border-[#D97706]/40 transition-colors"
          >
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyProfileLink}
                className="px-3 py-1.5 text-xs rounded-md bg-[#1A1814] hover:bg-[#D97706]/10 text-[#E8E4D9] transition-colors"
              >
                Copy link
              </button>
              {!readOnly && (
                <button
                  type="button"
                  disabled={exportingPdf}
                  onClick={handleExportPdf}
                  className="px-3 py-1.5 text-xs rounded-md bg-[#D97706] hover:bg-[#F59E0B] text-[#0A0A08] font-semibold transition-colors disabled:opacity-60"
                >
                  {exportingPdf ? "Exporting…" : "Export PDF"}
                </button>
              )}
              {actionMessage && (
                <span className="text-[10px] text-[#78716C]">{actionMessage}</span>
              )}
            </div>
            <ProfileHeader user={analytics?.user} />
          </motion.div>

          {/* Performance Overview */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 bg-gradient-to-b from-[#D97706] to-transparent rounded-full"></div>
              <h2
                className="text-[#E8E4D9] text-xs font-medium uppercase tracking-widest"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Performance Overview
              </h2>
            </div>
            <StatsOverview stats={analytics?.overview} />
          </motion.section>

          {/* Cognitive Profile - MIM */}
          {analytics?.user?._id && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 bg-gradient-to-b from-[#D97706] to-transparent rounded-full"></div>
                <h2
                  className="text-[#E8E4D9] text-xs font-medium uppercase tracking-widest"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  AI Cognitive Profile
                </h2>
              </div>
              <CognitiveProfile userId={analytics.user._id} />
            </motion.section>
          )}

          {/* Problem Recommendations - MIM */}
          {analytics?.user?._id && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 bg-gradient-to-b from-[#D97706] to-transparent rounded-full"></div>
                <h2
                  className="text-[#E8E4D9] text-xs font-medium uppercase tracking-widest"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  Recommended Problems
                </h2>
              </div>
              <ProblemRecommendations userId={analytics.user._id} limit={5} />
            </motion.section>
          )}

          {/* Learning Roadmap - MIM */}
          {analytics?.user?._id && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 bg-gradient-to-b from-[#D97706] to-transparent rounded-full"></div>
                <h2
                  className="text-[#E8E4D9] text-xs font-medium uppercase tracking-widest"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  Learning Roadmap
                </h2>
              </div>
              <LearningRoadmap userId={analytics.user._id} />
            </motion.section>
          )}

          {/* Contests - User Dashboard */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-gradient-to-b from-[#D97706] to-transparent rounded-full"></div>
                <h2
                  className="text-[#E8E4D9] text-xs font-medium uppercase tracking-widest"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  Contests
                </h2>
              </div>
              <Link
                to="/contests"
                className="text-xs text-[#D97706] hover:text-[#F59E0B] transition-colors"
              >
                View all →
              </Link>
            </div>

            <div className="rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-4 hover:border-[#D97706]/40 transition-colors">
              {contestsLoading ? (
                <div className="text-[#78716C] text-sm">Loading contests…</div>
              ) : contestsError ? (
                <div className="text-red-400 text-sm">{contestsError}</div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Live */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[#E8E4D9] text-sm font-semibold">Live now</h3>
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

                  {/* Upcoming */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[#E8E4D9] text-sm font-semibold">Upcoming</h3>
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
                                    disabled={
                                      readOnly || Boolean(busy[contestId])
                                    }
                                    onClick={
                                      readOnly
                                        ? undefined
                                        : () => handleRegister(contest)
                                    }
                                    className="px-2.5 py-1.5 text-xs rounded-md bg-[#D97706] hover:bg-[#F59E0B] text-[#0A0A08] font-semibold transition-colors disabled:opacity-60"
                                  >
                                    {busy[contestId]
                                      ? "Registering…"
                                      : "Register"}
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

          {/* Activity Calendar */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.35 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 bg-gradient-to-b from-[#D97706] to-transparent rounded-full"></div>
              <h2
                className="text-[#E8E4D9] text-xs font-medium uppercase tracking-widest"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Activity Calendar
              </h2>
            </div>
            <div className="rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-4 hover:border-[#D97706]/40 transition-colors">
              <ActivityHeatmap activity={analytics?.activity} />
            </div>
          </motion.section>

          {/* Category & Submissions Grid */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {/* Category Breakdown */}
            <motion.section variants={itemVariants}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 bg-gradient-to-b from-[#F59E0B] to-transparent rounded-full"></div>
                <h2
                  className="text-[#E8E4D9] text-xs font-medium uppercase tracking-widest"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  Category Breakdown
                </h2>
              </div>
              <div className="rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-4 hover:border-[#D97706]/40 transition-colors">
                <CategoryChart categories={analytics?.categories} />
              </div>
            </motion.section>

            {/* Recent Submissions */}
            <motion.section variants={itemVariants}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 bg-gradient-to-b from-[#F59E0B] to-transparent rounded-full"></div>
                <h2
                  className="text-[#E8E4D9] text-xs font-medium uppercase tracking-widest"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  Recent Submissions
                </h2>
              </div>
              <div className="rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-4 hover:border-[#D97706]/40 transition-colors">
                <SubmissionSummary
                  submissions={analytics?.recentSubmissions}
                />
              </div>
            </motion.section>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
