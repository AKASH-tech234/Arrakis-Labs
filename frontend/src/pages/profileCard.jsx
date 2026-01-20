// src/pages/profileCard.jsx
import { useEffect, useMemo, useState } from "react";
import AppHeader from "../components/layout/AppHeader";
import useProfileAnalytics from "../hooks/useProfileAnalytics";
import { useAuth } from "../context/AuthContext";
import {
  addPlatformProfile,
  getMyPlatformProfiles,
  updatePlatformProfile,
} from "../services/profileDashboardApi";

const PLATFORM_LABELS = {
  arrakis: "Arrakis",
  leetcode: "LeetCode",
  codeforces: "Codeforces",
  codechef: "CodeChef",
  atcoder: "AtCoder",
  hackerrank: "HackerRank",
  custom: "Custom",
};

const PLATFORM_BADGES = {
  arrakis: "AR",
  leetcode: "LC",
  codeforces: "CF",
  codechef: "CC",
  atcoder: "AC",
  hackerrank: "HR",
  custom: "CU",
};

const MANAGE_PLATFORMS = [
  { key: "leetcode", label: "LeetCode", badge: "LC" },
  { key: "codeforces", label: "Codeforces", badge: "CF" },
  { key: "codechef", label: "CodeChef", badge: "CC" },
  { key: "atcoder", label: "AtCoder", badge: "AC" },
  { key: "hackerrank", label: "HackerRank", badge: "HR" },
];

function isValidHttpUrl(value) {
  if (!value) return true;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function deriveHandleFromUrl(platform, url) {
  if (!url) return "";

  let pathname = "";
  try {
    pathname = new URL(url).pathname || "";
  } catch {
    return "";
  }

  const parts = pathname.split("/").filter(Boolean);
  const takeLast = () => (parts.length ? parts[parts.length - 1] : "");

  switch (platform) {
    case "leetcode": {
      const idxU = parts.indexOf("u");
      if (idxU >= 0 && parts[idxU + 1]) return parts[idxU + 1];
      return takeLast();
    }
    case "codeforces": {
      const idx = parts.indexOf("profile");
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
      return takeLast();
    }
    case "codechef": {
      const idx = parts.indexOf("users");
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
      return takeLast();
    }
    case "atcoder": {
      const idx = parts.indexOf("users");
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
      return takeLast();
    }
    case "hackerrank": {
      const idx = parts.indexOf("profile");
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
      return takeLast();
    }
    default:
      return "";
  }
}

function normalizeProfiles(profiles) {
  const byPlatform = new Map((profiles || []).map((p) => [p.platform, p]));
  return MANAGE_PLATFORMS.map((p) => {
    const existing = byPlatform.get(p.key);
    return {
      platform: p.key,
      label: p.label,
      badge: p.badge,
      id: existing?._id || null,
      profileUrl: existing?.profileUrl || "",
      handle: existing?.handle || "",
      isEnabled: existing?.isEnabled !== false,
    };
  });
}

function deriveTags({ platforms = [], language } = {}) {
  const tags = [];

  if (language) {
    const normalized = String(language).trim();
    if (normalized) tags.push(`#${normalized}`);
  }

  const hasCompetitive = platforms.some((p) =>
    ["codeforces", "codechef", "atcoder"].includes(p?.platform)
  );
  if (hasCompetitive) tags.push("#CP");

  const hasPractice = platforms.some((p) =>
    ["arrakis", "leetcode", "hackerrank"].includes(p?.platform)
  );
  if (hasPractice) tags.push("#DSA");

  return Array.from(new Set(tags));
}

export default function ProfileCardPage() {
  const { user } = useAuth();
  const { data, loading, error, refetch } = useProfileAnalytics();

  const [manageOpen, setManageOpen] = useState(false);
  const [rows, setRows] = useState(() => normalizeProfiles([]));
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsSaving, setRowsSaving] = useState(false);
  const [rowsError, setRowsError] = useState(null);

  const displayName = data?.user?.name || user?.name || "User";
  const username = data?.user?.username || (user?.email ? user.email.split("@")[0] : "user");

  const solved = data?.overview?.problemsSolved ?? 0;
  const activeDays = data?.overview?.activeDays ?? 0;

  const platforms = Array.isArray(data?.platforms) ? data.platforms : [];
  const connectedPlatforms = platforms.filter((p) => p?.handle && p?.isEnabled !== false);

  const language = user?.preferences?.language || null;
  const tags = deriveTags({ platforms: connectedPlatforms, language });

  const validationErrors = useMemo(() => {
    const errs = new Map();
    for (const r of rows) {
      if (r.profileUrl && !isValidHttpUrl(r.profileUrl)) {
        errs.set(r.platform, "Invalid URL (must start with http/https)");
        continue;
      }
      if (r.profileUrl && !r.handle) {
        errs.set(r.platform, "Handle is required");
      }
    }
    return errs;
  }, [rows]);

  useEffect(() => {
    if (!manageOpen) return;

    let cancelled = false;
    const load = async () => {
      try {
        setRowsLoading(true);
        setRowsError(null);
        const profiles = await getMyPlatformProfiles();
        if (cancelled) return;
        setRows(normalizeProfiles(profiles));
      } catch (e) {
        if (cancelled) return;
        setRowsError(e?.response?.data?.message || e?.message || "Failed to load platforms");
      } finally {
        if (!cancelled) setRowsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [manageOpen]);

  const updateRow = (platform, patch) => {
    setRows((prev) => prev.map((r) => (r.platform === platform ? { ...r, ...patch } : r)));
  };

  const handleUrlChange = (platform, value) => {
    const nextUrl = value;
    const current = rows.find((r) => r.platform === platform);

    if (!current) {
      updateRow(platform, { profileUrl: nextUrl });
      return;
    }

    const derived = deriveHandleFromUrl(platform, nextUrl);
    updateRow(platform, {
      profileUrl: nextUrl,
      handle: derived || current.handle,
    });
  };

  const handleRemove = (platform) => {
    updateRow(platform, { profileUrl: "", handle: "", isEnabled: false });
  };

  const savePlatforms = async () => {
    if (validationErrors.size) {
      setRowsError("Please fix validation errors before saving.");
      return;
    }

    setRowsSaving(true);
    setRowsError(null);

    try {
      for (const r of rows) {
        const wantsConnected = Boolean(r.profileUrl);

        if (r.id) {
          await updatePlatformProfile(r.id, {
            profileUrl: wantsConnected ? r.profileUrl : "",
            handle: wantsConnected ? r.handle : "",
            isEnabled: wantsConnected ? r.isEnabled : false,
          });
          continue;
        }

        if (!wantsConnected) continue;

        const created = await addPlatformProfile({
          platform: r.platform,
          profileUrl: r.profileUrl,
          handle: r.handle,
        });

        if (created?._id && r.isEnabled === false) {
          await updatePlatformProfile(created._id, { isEnabled: false });
        }
      }

      const profiles = await getMyPlatformProfiles();
      setRows(normalizeProfiles(profiles));
      await refetch?.();
      setManageOpen(false);
    } catch (e) {
      setRowsError(e?.response?.data?.message || e?.message || "Failed to save");
    } finally {
      setRowsSaving(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: "#0A0A08" }}>
      <AppHeader />

      <main className="pt-20 relative z-10">
        <div className="max-w-3xl mx-auto px-6 lg:px-12 py-12">
          <div className="mb-6">
            <h1
              className="text-[#E8E4D9] text-sm font-medium uppercase tracking-widest"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Profile Card
            </h1>
          </div>

          {loading && (
            <div className="text-[#78716C] text-sm">Loading…</div>
          )}

          {!loading && error && (
            <div className="text-red-300 text-sm">{error}</div>
          )}

          {!loading && !error && (
            <div className="bg-gradient-to-br from-[#1A1814]/50 to-[#0A0A08]/50 border border-[#D97706]/20 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 border border-[#1A1814] rounded-lg overflow-hidden flex items-center justify-center bg-black/20">
                  {data?.user?.profileImage ? (
                    <img
                      src={data.user.profileImage}
                      alt={displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span
                      className="text-[#78716C] text-sm uppercase"
                      style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                    >
                      {displayName.charAt(0)}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div
                    className="text-[#E8E4D9] text-base font-semibold"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    {displayName}
                  </div>
                  <div
                    className="text-[#78716C] text-xs uppercase tracking-wider mt-0.5"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    @{username}
                  </div>

                  {data?.user?.descriptor && (
                    <div className="text-[#D97706]/80 text-xs mt-2">{data.user.descriptor}</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-5">
                <Metric label="Total solved" value={solved} />
                <Metric label="Active days" value={activeDays} />
              </div>

              <div className="mt-5">
                <div className="text-[#78716C] text-[10px] uppercase tracking-wider">Platforms</div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {connectedPlatforms.length === 0 ? (
                    <span className="text-[#78716C] text-xs">Not connected</span>
                  ) : (
                    connectedPlatforms.map((p) => (
                      <div
                        key={p._id || p.platform}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-white/10 bg-black/20"
                        title={PLATFORM_LABELS[p.platform] || p.platform}
                      >
                        <div className="w-6 h-6 rounded-md border border-white/10 flex items-center justify-center text-[#E8E4D9] text-[10px]">
                          {PLATFORM_BADGES[p.platform] || "--"}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[#E8E4D9] text-xs">
                            {PLATFORM_LABELS[p.platform] || p.platform}
                          </div>
                          {p.handle && (
                            <div className="text-[#78716C] text-[10px] truncate max-w-[180px]">
                              @{p.handle}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-5">
                <div className="text-[#78716C] text-[10px] uppercase tracking-wider">Tags</div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.length === 0 ? (
                    <span className="text-[#78716C] text-xs">—</span>
                  ) : (
                    tags.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-1 rounded-md border border-white/10 bg-black/20 text-[#E8E4D9] text-xs"
                      >
                        {t}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-5">
                {!manageOpen ? (
                  <button
                    type="button"
                    onClick={() => setManageOpen(true)}
                    className="text-[#78716C] hover:text-[#E8E4D9] transition-colors text-xs uppercase tracking-wider"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    Manage Coding Platforms
                  </button>
                ) : (
                  <div className="bg-black/20 border border-white/10 rounded-xl p-4">
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <div
                        className="text-[#E8E4D9] text-xs font-medium uppercase tracking-widest"
                        style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                      >
                        Manage Coding Platforms
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setManageOpen(false)}
                          disabled={rowsSaving}
                          className="px-3 py-2 text-xs rounded-md bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors disabled:opacity-60"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={savePlatforms}
                          disabled={rowsSaving || rowsLoading}
                          className="px-4 py-2 text-xs rounded-md bg-[#D97706] hover:bg-[#F59E0B] text-black font-semibold disabled:opacity-60"
                        >
                          {rowsSaving ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>

                    {rowsLoading && <div className="text-[#78716C] text-sm">Loading…</div>}
                    {!rowsLoading && rowsError && (
                      <div className="text-red-300 text-sm mb-3">{rowsError}</div>
                    )}

                    <div className="divide-y divide-white/10">
                      {rows.map((r) => {
                        const connected = Boolean(r.profileUrl) && r.isEnabled;
                        const rowError = validationErrors.get(r.platform);

                        return (
                          <div key={r.platform} className="py-4 first:pt-0 last:pb-0">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3">
                                <div className="w-9 h-9 rounded-lg border border-white/10 bg-black/20 flex items-center justify-center text-[#E8E4D9] text-xs">
                                  {r.badge}
                                </div>
                                <div>
                                  <div className="text-[#E8E4D9] font-semibold text-sm">{r.label}</div>
                                  <div className="text-[#78716C] text-xs mt-0.5">
                                    Status: {connected ? "Connected" : "Not connected"}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => updateRow(r.platform, { isEnabled: !r.isEnabled })}
                                  className="px-3 py-2 text-xs rounded-md bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors"
                                  disabled={!r.profileUrl && !r.id}
                                  title={!r.profileUrl && !r.id ? "Add a URL first" : "Toggle enabled"}
                                >
                                  {r.isEnabled ? "Enabled" : "Disabled"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemove(r.platform)}
                                  className="px-3 py-2 text-xs rounded-md bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                              <input
                                value={r.handle}
                                onChange={(e) => updateRow(r.platform, { handle: e.target.value })}
                                placeholder="Handle / Username"
                                className="bg-[#0A0A08] border border-white/10 rounded-md px-3 py-2 text-sm text-[#E8E4D9]"
                              />

                              <input
                                value={r.profileUrl}
                                onChange={(e) => handleUrlChange(r.platform, e.target.value)}
                                placeholder="Profile URL"
                                className="bg-[#0A0A08] border border-white/10 rounded-md px-3 py-2 text-sm text-[#E8E4D9] md:col-span-2"
                              />
                            </div>

                            {rowError && <div className="text-red-300 text-xs mt-2">{rowError}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="bg-black/20 border border-white/10 rounded-lg p-4">
      <div className="text-[#78716C] text-[10px] uppercase tracking-wider">{label}</div>
      <div className="text-[#E8E4D9] text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}
