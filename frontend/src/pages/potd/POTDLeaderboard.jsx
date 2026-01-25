import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import AppHeader from "../../components/layout/AppHeader";
import { getStreakLeaderboard } from "../../services/potd/potdApi";
import POTDLeaderboardTable from "../../components/potd/POTDLeaderboardTable";
import POTDSection from "../../components/potd/shared/POTDSection";
import POTDEmptyState from "../../components/potd/shared/POTDEmptyState";

export default function POTDLeaderboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getStreakLeaderboard(50);
        if (!mounted) return;

        if (!response.success) {
          setError(response.error || "Failed to load leaderboard");
          setRows([]);
          return;
        }

        setRows(response.data?.leaderboard ?? []);
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || e?.message || "Failed to load leaderboard");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A08]">
      <AppHeader />

      <main className="pt-14">
        <div className="max-w-6xl mx-auto px-6 lg:px-12 py-12 space-y-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-end justify-between gap-4 flex-wrap"
          >
            <div>
              <h1
                className="text-[#E8E4D9] text-3xl md:text-4xl font-bold tracking-[0.15em] uppercase"
                style={{ fontFamily: "'Rajdhani', 'Orbitron', system-ui, sans-serif" }}
              >
                Leaderboard
              </h1>
              <p
                className="text-[#A29A8C] text-base tracking-wider mt-3"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Ranked by current streak with totals for consistency.
              </p>
            </div>

            <Link
              to="/potd"
              className="px-4 py-2 rounded border border-[#2A2A24] bg-[#0A0A08] text-[#E8E4D9] hover:border-[#D97706]/50 hover:shadow-[0_0_0_1px_rgba(217,119,6,0.25)] transition-all text-xs tracking-[0.2em] uppercase"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Back to Today
            </Link>
          </motion.div>

          <POTDSection title="Top Streaks" subtitle="Daily consistency, measured in UTC days.">
            {loading ? (
              <div className="text-[#A29A8C]">Loading…</div>
            ) : error ? (
              <div className="text-red-400">{error}</div>
            ) : rows.length === 0 ? (
              <POTDEmptyState title="No leaderboard yet" description="Once users solve POTD, rankings appear here." />
            ) : (
              <POTDLeaderboardTable rows={rows} />
            )}
          </POTDSection>
        </div>
      </main>
    </div>
  );
}
