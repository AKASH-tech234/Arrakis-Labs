import { useEffect, useMemo, useState } from "react";
import { getContestHistory, getContestRating, getContestStats } from "../../services/profileDashboardApi";

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-[#D97706]/15 bg-[#0A0A08]/40 px-4 py-3">
      <div className="text-xs text-[#A8A29E]">{label}</div>
      <div className="text-[#E8E4D9] text-lg font-semibold mt-1">{value}</div>
    </div>
  );
}

function formatDate(d) {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleDateString();
}

function RatingSparkline({ points }) {
  const series = (points || [])
    .map((p) => ({ x: p.date ? new Date(p.date).getTime() : null, y: p.ratingAfter }))
    .filter((p) => p.x && Number.isFinite(p.y));

  if (series.length < 2) {
    return <div className="text-sm text-[#A8A29E]">Not enough rating points yet.</div>;
  }

  const width = 520;
  const height = 120;
  const padding = 8;

  const xs = series.map((p) => p.x);
  const ys = series.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const scaleX = (x) =>
    padding + ((x - minX) / Math.max(1, maxX - minX)) * (width - padding * 2);
  const scaleY = (y) =>
    padding + (1 - (y - minY) / Math.max(1, maxY - minY)) * (height - padding * 2);

  const d = series
    .map((p, idx) => `${idx === 0 ? "M" : "L"}${scaleX(p.x).toFixed(2)},${scaleY(p.y).toFixed(2)}`)
    .join(" ");

  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height} className="block">
        <defs>
          <linearGradient id="ratingLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#D97706" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <path d={d} fill="none" stroke="url(#ratingLine)" strokeWidth="2.5" />
        {series.map((p) => (
          <circle
            key={p.x}
            cx={scaleX(p.x)}
            cy={scaleY(p.y)}
            r="3"
            fill="#F59E0B"
            opacity="0.9"
          />
        ))}
      </svg>
    </div>
  );
}

export default function ContestSection({ platforms = [], username }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [rating, setRating] = useState([]);
  const [error, setError] = useState(null);

  const platformCounts = useMemo(() => {
    const counts = {};
    for (const p of platforms || []) {
      const platformName = p.platform || p?.platformItem?.platform || p?.stats?.platform;
      const contests = p?.stats?.contestsParticipated ?? p?.contestsParticipated;
      if (!platformName) continue;
      counts[platformName] = Number(contests) || 0;
    }
    return counts;
  }, [platforms]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getContestStats({ username }),
      getContestHistory({ username }),
      getContestRating({ username }),
    ])
      .then(([s, h, r]) => {
        if (cancelled) return;
        setStats(s || null);
        setHistory(h?.history || []);
        setRating(r?.points || []);
      })
      .catch((e) => {
        console.warn("[ContestSection] Contest data unavailable:", e);
        if (cancelled) return;
        setError(e?.message || "Contest data unavailable");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [username]);

  const recent = (history || []).slice(0, 5);

  return (
    <section className="bg-gradient-to-br from-[#1A1814]/50 to-[#0A0A08]/50 border border-[#D97706]/20 rounded-xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[#E8E4D9] font-semibold">Contests</div>
          <div className="text-[#78716C] text-sm mt-1">History, rankings, and rating movement</div>
        </div>
      </div>

      {loading ? (
        <div className="text-[#E8E4D9]/70 mt-4">Loading contest stats…</div>
      ) : error ? (
        <div className="text-[#FCA5A5] mt-4">
          {error}
          <div className="text-[#A8A29E] text-sm mt-1">Showing other profile sections as normal.</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            <Stat label="Total contests" value={stats?.totalContests ?? 0} />
            <Stat label="Best rank" value={stats?.bestRank ?? "-"} />
            <Stat
              label="Platforms (contest count)"
              value={Object.entries(platformCounts)
                .map(([k, v]) => `${k}: ${v}`)
                .join(" • ") || "-"}
            />
          </div>

          <div className="mt-6">
            <div className="text-[#E8E4D9] font-semibold mb-2">Rating changes</div>
            <RatingSparkline points={rating} />
          </div>

          <div className="mt-6">
            <div className="text-[#E8E4D9] font-semibold mb-2">Recent contests</div>
            {!recent.length ? (
              <div className="text-sm text-[#A8A29E]">No contest history yet.</div>
            ) : (
              <div className="space-y-2">
                {recent.map((c) => (
                  <div
                    key={String(c.contestId || c.registeredAt)}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[#D97706]/10 bg-[#0A0A08]/40 px-4 py-3"
                  >
                    <div>
                      <div className="text-[#E8E4D9] text-sm font-medium">
                        {c.contestName || "Contest"}
                      </div>
                      <div className="text-xs text-[#A8A29E]">
                        {formatDate(c.endTime || c.startTime || c.registeredAt)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-[#E8E4D9]">Rank: {c.finalRank ?? "-"}</div>
                      <div
                        className={`text-xs ${
                          (c.ratingChange || 0) > 0
                            ? "text-emerald-300"
                            : (c.ratingChange || 0) < 0
                            ? "text-red-300"
                            : "text-[#A8A29E]"
                        }`}
                      >
                        Δ {c.ratingChange ?? 0}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
