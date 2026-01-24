import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import AppHeader from "../../components/layout/AppHeader";
import { getPOTDHistory } from "../../services/potdApi";
import POTDHistoryList from "../../components/potd/POTDHistoryList";
import POTDSection from "../../components/potd/shared/POTDSection";
import POTDEmptyState from "../../components/potd/shared/POTDEmptyState";

export default function POTDHistory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getPOTDHistory();
        if (!mounted) return;

        if (!response.success) {
          setError(response.error || "Failed to load history");
          setItems([]);
          return;
        }

        setItems(response.data?.history ?? []);
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || e?.message || "Failed to load history");
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
                POTD History
              </h1>
              <p
                className="text-[#A29A8C] text-base tracking-wider mt-3"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Review past daily challenges and revisit problems you missed.
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

          <POTDSection title="Archive" subtitle="Your recorded POTDs (UTC).">
            {loading ? (
              <div className="text-[#A29A8C]">Loading…</div>
            ) : error ? (
              <div className="text-red-400">{error}</div>
            ) : items.length === 0 ? (
              <POTDEmptyState title="No history yet" description="Solve a POTD to start building your archive." />
            ) : (
              <POTDHistoryList items={items} />
            )}
          </POTDSection>
        </div>
      </main>
    </div>
  );
}
