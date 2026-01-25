import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import AppHeader from "../../components/layout/AppHeader";
import ProfileHeader from "../../components/charts/ProfileHeader";
import ActivityHeatmap from "../../components/charts/ActivityHeatmap";
import CodingProfileModal from "../../components/profile/CodingProfileModal";
import { StatCard } from "../../components/ui/shared";
import { Trophy, TrendingUp, ExternalLink } from "lucide-react";
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

const platformLogos = {
  leetcode: "🟧",
  codeforces: "🔵",
  codechef: "⭐",
  atcoder: "🔷",
  hackerrank: "🟢",
  arrakis: "🏛️",
  custom: "🔗"
};

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
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A08" }}>
      <AppHeader />

      <main className="pt-16">
        <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6 space-y-6">
          {/* Header Card */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="relative rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-5 hover:border-[#D97706]/40 transition-colors"
          >
            <div className="absolute top-4 right-4 z-20">
              <button
                type="button"
                onClick={openAdd}
                className="px-3 py-1.5 text-xs rounded-md bg-[#D97706] hover:bg-[#F59E0B] text-[#0A0A08] font-semibold transition-colors"
              >
                Add Profile
              </button>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 bg-gradient-to-b from-[#D97706] to-transparent rounded-full"></div>
              <h2
                className="text-[#E8E4D9] text-xs font-medium uppercase tracking-widest"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Coding Profile
              </h2>
            </div>

            {loading ? (
              <p className="text-[#78716C] text-sm">Loading…</p>
            ) : error ? (
              <p className="text-red-400 text-sm">{error}</p>
            ) : (
              <ProfileHeader user={{ ...(summarySafe?.user || {}), descriptor: "Coding profile" }} />
            )}
          </motion.div>

          {!loading && !error && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 bg-gradient-to-b from-[#D97706] to-transparent rounded-full"></div>
                  <h2
                    className="text-[#E8E4D9] text-xs font-medium uppercase tracking-widest"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    Overview
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setView(VIEW.combined)}
                    className={`px-2.5 py-1.5 text-xs rounded-md border transition-colors ${
                      view === VIEW.combined
                        ? "bg-[#D97706]/10 text-[#D97706] border-[#D97706]/30"
                        : "bg-[#1A1814] text-[#E8E4D9] border-[#1A1814] hover:border-[#D97706]/30"
                    }`}
                  >
                    Combined
                  </button>
                  <button
                    type="button"
                    onClick={() => setView(VIEW.platform)}
                    className={`px-2.5 py-1.5 text-xs rounded-md border transition-colors ${
                      view === VIEW.platform
                        ? "bg-[#D97706]/10 text-[#D97706] border-[#D97706]/30"
                        : "bg-[#1A1814] text-[#E8E4D9] border-[#1A1814] hover:border-[#D97706]/30"
                    }`}
                  >
                    Platform
                  </button>
                </div>
              </div>

              {view === VIEW.platform && (
                <div className="mb-4">
                  <label className="block text-[10px] uppercase tracking-widest text-[#78716C] mb-1.5" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
                    Select platform
                  </label>
                  <select
                    value={selectedPlatform}
                    onChange={(e) => setSelectedPlatform(e.target.value)}
                    className="w-full sm:w-64 bg-[#0A0A08] border border-[#1A1814] rounded-lg px-3 py-2 text-sm text-[#E8E4D9]"
                  >
                    {connectedPlatforms.map((p) => (
                      <option key={p.platform} value={p.platform}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <StatCard label="Total Solved" value={statsForSelected.totalSolved ?? 0} icon={Trophy} />
                <StatCard label={view === VIEW.combined ? "Best Rating" : "Rating"} value={statsForSelected.rating ?? "—"} icon={TrendingUp} />
              </div>

              <div className="rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-4">
                <h3 className="text-[#E8E4D9] text-xs uppercase tracking-widest mb-3" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
                  Activity
                </h3>
                <ActivityHeatmap activity={activity} />
              </div>
            </motion.section>
          )}

          {!loading && !error && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 bg-gradient-to-b from-[#D97706] to-transparent rounded-full"></div>
                  <h2
                    className="text-[#E8E4D9] text-xs font-medium uppercase tracking-widest"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    Platforms
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={openAdd}
                  className="px-2.5 py-1.5 text-xs rounded-md bg-[#1A1814] hover:bg-[#D97706]/10 text-[#E8E4D9] transition-colors"
                >
                  Add Profile
                </button>
              </div>

              {/* Platform Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {platforms.length === 0 ? (
                  <div className="col-span-full rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-4 text-[#78716C] text-sm">
                    No external profiles added yet.
                  </div>
                ) : (
                  platforms.map((p) => (
                    <div 
                      key={p?.id || p?._id || `${p?.platform || "platform"}:${p?.profileUrl || ""}`} 
                      className="rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-4 hover:border-[#D97706]/40 transition-colors"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{platformLogos[p.platform?.toLowerCase()] || platformLogos.custom}</span>
                          <div>
                            <p className="text-sm font-semibold text-[#E8E4D9]" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
                              {formatPlatformName(p.platform)}
                            </p>
                            {p.handle && <p className="text-xs text-[#78716C]">{p.handle}</p>}
                          </div>
                        </div>
                        {p.profileUrl && (
                          <a
                            href={p.profileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-md bg-[#1A1814] hover:bg-[#D97706]/10 text-[#78716C] hover:text-[#D97706] transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-[#0A0A08] rounded-lg p-2.5">
                          <p className="text-[9px] uppercase tracking-wider text-[#78716C]">Solved</p>
                          <p className="text-sm font-bold text-[#E8E4D9]">{p.stats?.totalSolved ?? "—"}</p>
                        </div>
                        <div className="bg-[#0A0A08] rounded-lg p-2.5">
                          <p className="text-[9px] uppercase tracking-wider text-[#78716C]">Rating</p>
                          <p className="text-sm font-bold text-[#E8E4D9]">{p.stats?.rating ?? "—"}</p>
                        </div>
                      </div>

                      {/* Sync Status */}
                      {p.syncStatus && (
                        <div className="flex items-center gap-1.5 mb-3">
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            p.syncStatus === 'synced' ? 'bg-green-400' : 
                            p.syncStatus === 'pending' ? 'bg-yellow-400' : 
                            p.lastSyncError ? 'bg-red-400' : 'bg-[#78716C]'
                          }`}></div>
                          <span className="text-[10px] text-[#78716C]">{p.syncStatus}</span>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 pt-2 border-t border-[#1A1814]">
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          className="flex-1 px-2 py-1.5 text-[10px] rounded-md bg-[#1A1814] hover:bg-[#D97706]/10 text-[#E8E4D9] transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSync(p)}
                          className="flex-1 px-2 py-1.5 text-[10px] rounded-md bg-[#1A1814] hover:bg-[#D97706]/10 text-[#E8E4D9] transition-colors"
                        >
                          Sync
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p)}
                          className="flex-1 px-2 py-1.5 text-[10px] rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-300 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {view === VIEW.combined && contributions.length > 0 && (
                <div className="mt-4 rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-4">
                  <h3 className="text-[#E8E4D9] text-xs uppercase tracking-widest mb-3" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
                    Contributions
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {contributions.map((c) => (
                      <div key={c?.platform || "platform"} className="bg-[#0A0A08] rounded-lg p-3">
                        <p className="text-xs font-semibold text-[#E8E4D9]" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
                          {formatPlatformName(c.platform)}
                        </p>
                        <div className="mt-1.5 text-[10px] text-[#78716C]">
                          {c.totalSolved ?? 0} solved • {c.rating ?? "—"}
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
