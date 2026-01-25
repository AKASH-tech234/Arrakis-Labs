import { useState, useEffect } from "react";
import { Flame, Trophy, TrendingUp, Calendar } from "lucide-react";
import { getUserStreak } from "../../services/potd/potdApi";

/**
 * Streak Display Widget
 * Shows user's current streak, max streak, and streak statistics
 */
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
      <div className={`bg-gray-800/50 rounded-xl ${compact ? "p-4" : "p-6"} animate-pulse`}>
        <div className="h-20 bg-gray-700/50 rounded"></div>
      </div>
    );
  }

  if (!streakData) {
    return null;
  }

  const { currentStreak, maxStreak, totalPOTDsSolved, lastSolvedDate } = streakData;

  // Determine flame intensity based on streak
  const getFlameColor = (streak) => {
    if (streak >= 30) return "text-purple-500";
    if (streak >= 14) return "text-orange-500";
    if (streak >= 7) return "text-yellow-500";
    if (streak >= 1) return "text-red-500";
    return "text-gray-500";
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
      <div className="flex items-center gap-3 bg-gray-800/50 rounded-lg px-4 py-2">
        <Flame className={`w-5 h-5 ${getFlameColor(currentStreak)}`} />
        <div>
          <span className="text-2xl font-bold text-white">{currentStreak}</span>
          <span className="text-sm text-gray-400 ml-1">day streak</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Flame className={`w-5 h-5 ${getFlameColor(currentStreak)}`} />
          Your Streak
        </h3>
        <span className="text-sm text-gray-400">{getStreakMessage(currentStreak)}</span>
      </div>

      {/* Main Streak Display */}
      <div className="flex items-center justify-center mb-6">
        <div className="relative">
          <div
            className={`w-32 h-32 rounded-full flex items-center justify-center bg-gradient-to-br ${
              currentStreak > 0
                ? "from-orange-500/20 to-red-500/20 border-2 border-orange-500/50"
                : "from-gray-700/50 to-gray-800/50 border-2 border-gray-600"
            }`}
          >
            <div className="text-center">
              <div className="text-4xl font-bold text-white">{currentStreak}</div>
              <div className="text-xs text-gray-400 uppercase tracking-wide">
                {currentStreak === 1 ? "Day" : "Days"}
              </div>
            </div>
          </div>
          {currentStreak > 0 && (
            <Flame
              className={`absolute -top-2 -right-2 w-8 h-8 ${getFlameColor(currentStreak)} animate-pulse`}
            />
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-3 bg-gray-800/50 rounded-lg">
          <Trophy className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
          <div className="text-xl font-bold text-white">{maxStreak}</div>
          <div className="text-xs text-gray-400">Best Streak</div>
        </div>
        <div className="text-center p-3 bg-gray-800/50 rounded-lg">
          <TrendingUp className="w-5 h-5 text-green-500 mx-auto mb-1" />
          <div className="text-xl font-bold text-white">{totalPOTDsSolved}</div>
          <div className="text-xs text-gray-400">Total Solved</div>
        </div>
        <div className="text-center p-3 bg-gray-800/50 rounded-lg">
          <Calendar className="w-5 h-5 text-blue-500 mx-auto mb-1" />
          <div className="text-xl font-bold text-white">
            {lastSolvedDate
              ? new Date(lastSolvedDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : "-"}
          </div>
          <div className="text-xs text-gray-400">Last Solved</div>
        </div>
      </div>

      {/* Streak Tips */}
      {currentStreak === 0 && (
        <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
          <p className="text-sm text-orange-300">
            💡 Solve today's POTD to start your streak!
          </p>
        </div>
      )}

      {currentStreak > 0 && currentStreak < 7 && (
        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-sm text-blue-300">
            🎯 {7 - currentStreak} more day{7 - currentStreak !== 1 ? "s" : ""} to reach a 7-day streak!
          </p>
        </div>
      )}
    </div>
  );
}
