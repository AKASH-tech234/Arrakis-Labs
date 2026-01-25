import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { History, Trophy, Flame } from "lucide-react";
import AppHeader from "../../components/layout/AppHeader";
import POTDCard from "../../components/potd/POTDCard";
import StreakWidget from "../../components/potd/StreakWidget";
import POTDCalendar from "../../components/potd/POTDCalendar";

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

      <main className="pt-16">
        <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6 space-y-6">
          {/* Compact Header */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center justify-between gap-4 flex-wrap"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#D97706]/10 border border-[#D97706]/20">
                <Flame className="w-5 h-5 text-[#D97706]" />
              </div>
              <div>
                <h1
                  className="text-[#E8E4D9] text-xl font-bold tracking-wider uppercase"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  Problem of the Day
                </h1>
                <p
                  className="text-[#78716C] text-xs"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  Daily challenge • Refreshes at 00:00 UTC
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/potd/history"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#1A1814] bg-[#0F0F0D] text-[#E8E4D9] hover:border-[#D97706]/40 transition-all text-xs"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                <History className="w-3.5 h-3.5" />
                History
              </Link>
              <Link
                to="/potd/leaderboard"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#1A1814] bg-[#0F0F0D] text-[#E8E4D9] hover:border-[#D97706]/40 transition-all text-xs"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                <Trophy className="w-3.5 h-3.5" />
                Leaderboard
              </Link>
            </div>
          </motion.div>

          {/* Main Grid - POTD Card + Streak */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" key={refreshKey}>
            <div className="lg:col-span-2">
              <POTDCard />
            </div>
            <div>
              <StreakWidget compact />
            </div>
          </div>

          {/* Calendar - Compact */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <POTDCalendar compact />
          </motion.div>
        </div>
      </main>
    </div>
  );
}
