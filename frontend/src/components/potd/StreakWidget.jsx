import { useState, useEffect } from "react";
import { Flame, Trophy, TrendingUp, Calendar } from "lucide-react";
import { getUserStreak } from "../../services/potd/potdApi";

export default function StreakWidget({ compact = false }) {
  const [streakData, setStreakData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStreakData();
  }, []);

  const fetchStreakData = async () => {
    try {
      const response = await getUserStreak();
      if (response.success) {
        setStreakData(response.data);
      }
    } catch (err) {
      console.error("Failed to fetch streak:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`rounded-xl border border-[#1A1814] bg-[#0F0F0D] ${compact ? "p-3" : "p-4"} animate-pulse`}>
        <div className="h-16 bg-[#1A1814] rounded"></div>
      </div>
    );
  }

  if (!streakData) {
    return null;
  }

  const { currentStreak, maxStreak, totalPOTDsSolved, lastSolvedDate } = streakData;

  const getFlameColor = (streak) => {
    if (streak >= 30) return "text-purple-400";
    if (streak >= 14) return "text-[#D97706]";
    if (streak >= 7) return "text-yellow-400";
    if (streak >= 1) return "text-orange-400";
    return "text-[#78716C]";
  };

  const getStreakMessage = (streak) => {
    if (streak >= 100) return "Legendary! 🔥";
    if (streak >= 50) return "On Fire! 🔥";
    if (streak >= 30) return "Unstoppable!";
    if (streak >= 14) return "2 Week Warrior!";
    if (streak >= 7) return "Week Champion!";
    if (streak >= 3) return "Building Momentum!";
    if (streak >= 1) return "Keep Going!";
    return "Start Your Streak!";
  };

  if (compact) {
    return (
      <div className="rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-4 hover:border-[#D97706]/40 transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Flame className={`w-4 h-4 ${getFlameColor(currentStreak)}`} />
            <span 
              className="text-xs font-semibold text-[#E8E4D9] uppercase tracking-wider"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Streak
            </span>
          </div>
          <span className="text-[10px] text-[#78716C]">{getStreakMessage(currentStreak)}</span>
        </div>

        {/* Current Streak */}
        <div className="flex items-baseline gap-1 mb-3">
          <span 
            className="text-3xl font-bold text-[#E8E4D9]"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {currentStreak}
          </span>
          <span className="text-xs text-[#78716C]">days</span>
        </div>

        {/* Mini Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#0A0A08] rounded-lg p-2 text-center">
            <Trophy className="w-3 h-3 text-yellow-400 mx-auto mb-0.5" />
            <div className="text-sm font-bold text-[#E8E4D9]">{maxStreak}</div>
            <div className="text-[8px] text-[#78716C] uppercase">Best</div>
          </div>
          <div className="bg-[#0A0A08] rounded-lg p-2 text-center">
            <TrendingUp className="w-3 h-3 text-green-400 mx-auto mb-0.5" />
            <div className="text-sm font-bold text-[#E8E4D9]">{totalPOTDsSolved}</div>
            <div className="text-[8px] text-[#78716C] uppercase">Total</div>
          </div>
          <div className="bg-[#0A0A08] rounded-lg p-2 text-center">
            <Calendar className="w-3 h-3 text-blue-400 mx-auto mb-0.5" />
            <div className="text-sm font-bold text-[#E8E4D9]">
              {lastSolvedDate
                ? new Date(lastSolvedDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : "—"}
            </div>
            <div className="text-[8px] text-[#78716C] uppercase">Last</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-4 hover:border-[#D97706]/40 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 
          className="text-sm font-semibold text-[#E8E4D9] flex items-center gap-2 uppercase tracking-wider"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          <Flame className={`w-4 h-4 ${getFlameColor(currentStreak)}`} />
          Your Streak
        </h3>
        <span className="text-[10px] text-[#78716C]">{getStreakMessage(currentStreak)}</span>
      </div>

      {/* Streak Circle */}
      <div className="flex items-center justify-center mb-4">
        <div className="relative">
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center ${
              currentStreak > 0
                ? "bg-[#D97706]/10 border border-[#D97706]/30"
                : "bg-[#1A1814] border border-[#1A1814]"
            }`}
          >
            <div className="text-center">
              <div 
                className="text-2xl font-bold text-[#E8E4D9]"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                {currentStreak}
              </div>
              <div className="text-[9px] text-[#78716C] uppercase tracking-wide">
                {currentStreak === 1 ? "Day" : "Days"}
              </div>
            </div>
          </div>
          {currentStreak > 0 && (
            <Flame
              className={`absolute -top-1 -right-1 w-5 h-5 ${getFlameColor(currentStreak)} animate-pulse`}
            />
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-2 bg-[#0A0A08] rounded-lg">
          <Trophy className="w-3.5 h-3.5 text-yellow-400 mx-auto mb-1" />
          <div className="text-base font-bold text-[#E8E4D9]">{maxStreak}</div>
          <div className="text-[9px] text-[#78716C] uppercase">Best</div>
        </div>
        <div className="text-center p-2 bg-[#0A0A08] rounded-lg">
          <TrendingUp className="w-3.5 h-3.5 text-green-400 mx-auto mb-1" />
          <div className="text-base font-bold text-[#E8E4D9]">{totalPOTDsSolved}</div>
          <div className="text-[9px] text-[#78716C] uppercase">Total</div>
        </div>
        <div className="text-center p-2 bg-[#0A0A08] rounded-lg">
          <Calendar className="w-3.5 h-3.5 text-blue-400 mx-auto mb-1" />
          <div className="text-base font-bold text-[#E8E4D9]">
            {lastSolvedDate
              ? new Date(lastSolvedDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : "—"}
          </div>
          <div className="text-[9px] text-[#78716C] uppercase">Last</div>
        </div>
      </div>

      {/* Tips */}
      {currentStreak === 0 && (
        <div className="mt-3 p-2.5 bg-[#D97706]/10 border border-[#D97706]/20 rounded-lg">
          <p className="text-xs text-[#D97706]">
            💡 Solve today's POTD to start your streak!
          </p>
        </div>
      )}

      {currentStreak > 0 && currentStreak < 7 && (
        <div className="mt-3 p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-xs text-blue-300">
            🎯 {7 - currentStreak} more day{7 - currentStreak !== 1 ? "s" : ""} to reach a 7-day streak!
          </p>
        </div>
      )}
    </div>
  );
}
