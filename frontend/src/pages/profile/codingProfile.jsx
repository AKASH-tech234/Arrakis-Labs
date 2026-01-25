// src/pages/codingProfile.jsx - Coding Profile Page
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import AppHeader from "../../components/layout/AppHeader";
import ProfileHeader from "../../components/charts/ProfileHeader";
import ActivityHeatmap from "../../components/charts/ActivityHeatmap";
import CodingProfileModal from "../../components/profile/CodingProfileModal";
import {
  addCodingProfile,
  deleteCodingProfile,
  getCodingProfileSummary,
  syncCodingProfile,
  updateCodingProfile,
} from "../../services/profile/codingProfileApi";

const VIEW = {
  combined: "combined",
  platform: "platform",
};

function formatPlatformName(platform) {
  switch (platform) {
    case "arrakis":
      return "Arrakis";
    case "leetcode":
      return "LeetCode";
    case "codeforces":
      return "Codeforces";
    case "codechef":
      return "CodeChef";
    case "atcoder":
      return "AtCoder";
    case "hackerrank":
      return "HackerRank";
    case "custom":
      return "Custom";
    default:
      return platform;
  }
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <p className="text-xs uppercase tracking-widest text-[#78716C]" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
        {label}
      </p>
      <p className="text-2xl font-bold text-[#E8E4D9] mt-2" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
        {value}
      </p>
    </div>
  );
}

export default function CodingProfile() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({});
  const [error, setError] = useState(null);

  const summarySafe = useMemo(() => {
    const DEFAULT = {
      user: {},
      platforms: [],
      combined: {
        totalSolved: 0,
        bestRating: null,
        activity: [],
        contributions: [],
      },
      internal: {
        stats: {
          totalSolved: 0,
          rating: null,
        },
        activity: [],
      },
    };

    const s = summary && typeof summary === "object" ? summary : {};
    const combined = s?.combined && typeof s.combined === "object" ? s.combined : {};
    const internal = s?.internal && typeof s.internal === "object" ? s.internal : {};
    const internalStats = internal?.stats && typeof internal.stats === "object" ? internal.stats : {};

    return {
      ...DEFAULT,
      ...s,
      user: s?.user && typeof s.user === "object" ? s.user : DEFAULT.user,
      platforms: Array.isArray(s?.platforms) ? s.platforms : DEFAULT.platforms,
      combined: {
        ...DEFAULT.combined,
        ...combined,
        activity: Array.isArray(combined?.activity) ? combined.activity : DEFAULT.combined.activity,
        contributions: Array.isArray(combined?.contributions)
          ? combined.contributions
          : DEFAULT.combined.contributions,
      },
      internal: {
        ...DEFAULT.internal,
        ...internal,
        stats: {
          ...DEFAULT.internal.stats,
          ...internalStats,
        },
        activity: Array.isArray(internal?.activity) ? internal.activity : DEFAULT.internal.activity,
      },
    };
  }, [summary]);

  const platforms = useMemo(() => {
    if (!Array.isArray(summarySafe?.platforms)) return [];
    return summarySafe.platforms.filter((p) => p && typeof p === "object");
  }, [summarySafe]);

  const contributions = useMemo(() => {
    if (!Array.isArray(summarySafe?.combined?.contributions)) return [];
    return summarySafe.combined.contributions.filter((c) => c && typeof c === "object");
  }, [summarySafe]);

  const [view, setView] = useState(VIEW.combined);
  const [selectedPlatform, setSelectedPlatform] = useState("arrakis");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [modalInitial, setModalInitial] = useState(null);

  const reload = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCodingProfileSummary();

      if (import.meta.env.DEV) {
        // Temporary verification logging
        // eslint-disable-next-line no-console
        console.log("[CodingProfile] /profile/coding-summary ->", data);
      }

      setSummary(data || {});
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load Coding Profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectedPlatforms = useMemo(() => {
    return [
      { platform: "arrakis", label: "Arrakis" },
      ...platforms
        .map((p) => p?.platform)
        .filter(Boolean)
        .map((platform) => ({ platform, label: formatPlatformName(platform) })),
    ];
  }, [platforms]);

  const activity = useMemo(() => {
    if (view === VIEW.combined) {
      const raw = summarySafe?.combined?.activity;
      if (!Array.isArray(raw)) return [];
      return raw.filter((d) => d && typeof d === "object" && d.date);
    }

    if (selectedPlatform === "arrakis") {
      const raw = summarySafe?.internal?.activity;
      if (!Array.isArray(raw)) return [];
      return raw.filter((d) => d && typeof d === "object" && d.date);
    }
    const p = platforms.find((x) => x?.platform === selectedPlatform);
    const raw = p?.activity;
    if (!Array.isArray(raw)) return [];
    return raw.filter((d) => d && typeof d === "object" && d.date);
  }, [summarySafe, view, selectedPlatform, platforms]);

  const statsForSelected = useMemo(() => {
    if (view === VIEW.combined) {
      return {
        totalSolved: summarySafe?.combined?.totalSolved ?? 0,
        rating: summarySafe?.combined?.bestRating ?? null,
      };
    }

    if (selectedPlatform === "arrakis") {
      return {
        totalSolved: summarySafe?.internal?.stats?.totalSolved ?? 0,
        rating: summarySafe?.internal?.stats?.rating ?? null,
      };
    }

    const p = platforms.find((x) => x?.platform === selectedPlatform);
    return {
      totalSolved: p?.stats?.totalSolved ?? 0,
      rating: p?.stats?.rating ?? null,
    };
  }, [summarySafe, view, selectedPlatform, platforms]);

  const openAdd = () => {
    setModalMode("add");
    setModalInitial(null);
    setModalOpen(true);
  };

  const openEdit = (profile) => {
    setModalMode("edit");
    setModalInitial(profile);
    setModalOpen(true);
  };

  const handleModalSubmit = async (payload) => {
    if (modalMode === "add") {
      await addCodingProfile(payload);
    } else {
      await updateCodingProfile(payload.id, {
        profileUrl: payload.profileUrl,
        handle: payload.handle,
      });
    }
    setModalOpen(false);
    await reload();
  };

  const handleDelete = async (profile) => {
    const ok = window.confirm(`Delete ${formatPlatformName(profile.platform)} profile?`);
    if (!ok) return;
    await deleteCodingProfile(profile.id);
    await reload();
  };

  const handleSync = async (profile) => {
    try {
      await syncCodingProfile(profile.id);
      await reload();
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || "Sync failed");
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
          backgroundSize: "50px 50px",
        }}
      ></div>

      <AppHeader />

      <main className="pt-20 relative z-10">
        <div className="max-w-5xl mx-auto px-6 lg:px-12 py-12">
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="mb-16 relative bg-gradient-to-br from-[#1A1814]/50 to-[#0A0A08]/50 backdrop-blur-sm border border-[#D97706]/20 rounded-xl p-8 hover:border-[#D97706]/40 transition-colors"
          >
            <div className="absolute top-6 right-6 z-20 flex items-center gap-2">
              <button
                type="button"
                onClick={openAdd}
                className="px-3 py-2 text-sm rounded-md bg-[#D97706] hover:bg-[#F59E0B] text-black font-semibold transition-colors"
              >
                Add Profile
              </button>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-6 bg-gradient-to-b from-[#D97706] to-transparent rounded-full"></div>
              <h2
                className="text-[#E8E4D9] text-sm font-medium uppercase tracking-widest"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Coding Profile
              </h2>
            </div>

            {loading ? (
              <p className="text-[#78716C]">Loading…</p>
            ) : error ? (
              <p className="text-red-400">{error}</p>
            ) : (
              <>
                <ProfileHeader user={{ ...(summarySafe?.user || {}), descriptor: "Coding profile" }} />
              </>
            )}
          </motion.div>

          {!loading && !error && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="mb-16"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-6 bg-gradient-to-b from-[#D97706] to-transparent rounded-full"></div>
                  <h2
                    className="text-[#E8E4D9] text-sm font-medium uppercase tracking-widest"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    Overview
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setView(VIEW.combined)}
                    className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                      view === VIEW.combined
                        ? "bg-white/10 text-white border-white/20"
                        : "bg-white/5 text-[#E8E4D9] border-white/10 hover:bg-white/10"
                    }`}
                  >
                    Combined
                  </button>
                  <button
                    type="button"
                    onClick={() => setView(VIEW.platform)}
                    className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                      view === VIEW.platform
                        ? "bg-white/10 text-white border-white/20"
                        : "bg-white/5 text-[#E8E4D9] border-white/10 hover:bg-white/10"
                    }`}
                  >
                    Platform
                  </button>
                </div>
              </div>

              {view === VIEW.platform && (
                <div className="mb-6">
                  <label className="block text-xs uppercase tracking-widest text-[#78716C] mb-2" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
                    Select platform
                  </label>
                  <select
                    value={selectedPlatform}
                    onChange={(e) => setSelectedPlatform(e.target.value)}
                    className="w-full sm:w-80 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-[#E8E4D9]"
                  >
                    {connectedPlatforms.map((p) => (
                      <option key={p.platform} value={p.platform}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                <StatCard label="Total Solved" value={statsForSelected.totalSolved ?? 0} />
                <StatCard label={view === VIEW.combined ? "Best Rating" : "Rating"} value={statsForSelected.rating ?? "—"} />
              </div>

              <div className="bg-gradient-to-br from-[#1A1814]/30 to-[#0A0A08]/40 border border-[#D97706]/10 rounded-xl p-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <h3 className="text-[#E8E4D9] text-sm uppercase tracking-widest" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
                    Activity
                  </h3>
                </div>
                <ActivityHeatmap activity={activity} />
              </div>
            </motion.section>
          )}

          {!loading && !error && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="mb-16"
            >
              <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-6 bg-gradient-to-b from-[#D97706] to-transparent rounded-full"></div>
                  <h2
                    className="text-[#E8E4D9] text-sm font-medium uppercase tracking-widest"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    Platforms
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={openAdd}
                  className="px-3 py-2 text-sm rounded-md bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors"
                >
                  Add Profile
                </button>
              </div>

              <div className="space-y-3">
                {platforms.length === 0 ? (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-[#78716C]">
                    No external profiles added yet.
                  </div>
                ) : (
                  platforms.map((p) => (
                      <div key={p?.id || p?._id || `${p?.platform || "platform"}:${p?.profileUrl || ""}`} className="bg-white/5 border border-white/10 rounded-xl p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                          <p className="text-[#E8E4D9] font-semibold" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
                            {formatPlatformName(p.platform)}
                            <span className="text-[#78716C] font-normal">{p.handle ? ` • ${p.handle}` : ""}</span>
                          </p>
                          <a
                            href={p.profileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-[#D97706] hover:underline break-all"
                          >
                            {p.profileUrl}
                          </a>
                          <div className="mt-2 text-xs text-[#78716C]">
                            Status: <span className="text-[#E8E4D9]">{p.syncStatus || "—"}</span>
                            {p.lastSyncError ? (
                              <span className="text-red-400"> • {p.lastSyncError}</span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <div className="px-3 py-2 text-sm rounded-md bg-black/20 border border-white/10 text-[#E8E4D9]">
                            Solved: {p.stats?.totalSolved ?? "—"}
                          </div>
                          <div className="px-3 py-2 text-sm rounded-md bg-black/20 border border-white/10 text-[#E8E4D9]">
                            Rating: {p.stats?.rating ?? "—"}
                          </div>

                          <button
                            type="button"
                            onClick={() => openEdit(p)}
                            className="px-3 py-2 text-sm rounded-md bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSync(p)}
                            className="px-3 py-2 text-sm rounded-md bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors"
                          >
                            Sync
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(p)}
                            className="px-3 py-2 text-sm rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-200 border border-red-500/20 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {view === VIEW.combined && contributions.length > 0 && (
                <div className="mt-10 bg-gradient-to-br from-[#1A1814]/30 to-[#0A0A08]/40 border border-[#D97706]/10 rounded-xl p-6">
                  <h3 className="text-[#E8E4D9] text-sm uppercase tracking-widest mb-4" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
                    Contributions
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {contributions.map((c) => (
                      <div key={c?.platform || "platform"} className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <p className="text-[#E8E4D9] font-semibold" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
                          {formatPlatformName(c.platform)}
                        </p>
                        <div className="mt-2 text-sm text-[#E8E4D9]">
                          Solved: {c.totalSolved ?? "—"} • Rating: {c.rating ?? "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.section>
          )}
        </div>
      </main>

      <CodingProfileModal
        open={modalOpen}
        mode={modalMode}
        initial={modalInitial}
        existingPlatforms={platforms.map((p) => p?.platform).filter(Boolean)}
        onClose={() => setModalOpen(false)}
        onSubmit={handleModalSubmit}
      />
    </div>
  );
}
