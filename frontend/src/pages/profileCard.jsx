// src/pages/profileCard.jsx
import AppHeader from "../components/layout/AppHeader";
import useProfileAnalytics from "../hooks/useProfileAnalytics";
import { useAuth } from "../context/AuthContext";

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

function countActiveDays(activity = []) {
  if (!Array.isArray(activity)) return 0;
  return activity.reduce((sum, d) => sum + ((d?.count || 0) > 0 ? 1 : 0), 0);
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
  const { data, loading, error } = useProfileAnalytics();

  const displayName = data?.user?.name || user?.name || "User";
  const username = data?.user?.username || (user?.email ? user.email.split("@")[0] : "user");

  const solved = data?.overview?.problemsSolved ?? 0;
  const activeDays = countActiveDays(data?.activity);

  const platforms = Array.isArray(data?.platforms) ? data.platforms : [];
  const connectedPlatforms = platforms.filter((p) => (p?.profileUrl || p?.handle) && p?.isEnabled !== false);

  const language = user?.preferences?.language || null;
  const tags = deriveTags({ platforms: connectedPlatforms, language });

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
                          {(p.handle || p.profileUrl) && (
                            <div className="text-[#78716C] text-[10px] truncate max-w-[180px]">
                              {p.handle ? `@${p.handle}` : p.profileUrl}
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
