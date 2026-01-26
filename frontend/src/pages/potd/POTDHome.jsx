import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import AppHeader from "../../components/layout/AppHeader";
import POTDCard from "../../components/potd/POTDCard";
import StreakWidget from "../../components/potd/StreakWidget";
import POTDCalendar from "../../components/potd/POTDCalendar";
import POTDSection from "../../components/potd/shared/POTDSection";

export default function POTDHome() {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const tick = setInterval(() => {
      const now = new Date();
      const msUntilNextUtcMidnight =
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0) -
        now.getTime();

      if (msUntilNextUtcMidnight >= 0 && msUntilNextUtcMidnight < 1200) {
        setRefreshKey((k) => k + 1);
      }
    }, 1000);

    return () => clearInterval(tick);
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
            className="relative overflow-hidden rounded-2xl border border-[#1A1814] bg-[#0F0F0D]"
          >
            <div className="absolute inset-0 pointer-events-none" style={{
              background:
                "radial-gradient(900px 400px at 20% 20%, rgba(217,119,6,0.20), transparent 60%), radial-gradient(800px 400px at 80% 60%, rgba(245,158,11,0.12), transparent 60%)",
            }} />
            <div className="relative p-8 md:p-10 flex items-end justify-between gap-6 flex-wrap">
              <div className="max-w-2xl">
                <h1
                  className="text-[#E8E4D9] text-3xl md:text-4xl font-bold tracking-[0.15em] uppercase"
                  style={{ fontFamily: "'Rajdhani', 'Orbitron', system-ui, sans-serif" }}
                >
                  Problem of the Day
                </h1>
                <p
                  className="text-[#A29A8C] text-base tracking-wider mt-3"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  A single curated challenge, refreshed daily at <span className="text-[#E8E4D9]">00:00 UTC</span>. Submit an
                  accepted solution to maintain your streak.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  to="/potd/history"
                  className="px-4 py-2 rounded border border-[#2A2A24] bg-[#0A0A08] text-[#E8E4D9] hover:border-[#D97706]/50 hover:shadow-[0_0_0_1px_rgba(217,119,6,0.25)] transition-all text-xs tracking-[0.2em] uppercase"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  History
                </Link>
                <Link
                  to="/potd/leaderboard"
                  className="px-4 py-2 rounded border border-[#2A2A24] bg-[#0A0A08] text-[#E8E4D9] hover:border-[#D97706]/50 hover:shadow-[0_0_0_1px_rgba(217,119,6,0.25)] transition-all text-xs tracking-[0.2em] uppercase"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  Leaderboard
                </Link>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2" key={refreshKey}>
              <POTDCard />
            </div>
            <div>
              <StreakWidget />
            </div>
          </div>

          <POTDSection
            title="Your Calendar"
            subtitle="Solved, missed, and active days (UTC)."
          >
            <POTDCalendar />
          </POTDSection>
        </div>
      </main>
    </div>
  );
}
