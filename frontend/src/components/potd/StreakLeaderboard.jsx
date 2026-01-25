import { useState, useEffect } from "react";
import { Trophy, Medal, Flame, User } from "lucide-react";
import { getStreakLeaderboard } from "../../services/potd/potdApi";

/**
 * Streak Leaderboard Component
 * Displays top users by POTD streak
 */
export default function StreakLeaderboard({ limit = 10 }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, [limit]);

  const fetchLeaderboard = async () => {
    try {
      const response = await getStreakLeaderboard(limit);
      if (response.success) {
        setLeaderboard(response.data.leaderboard);
      }
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-400" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-300" />;
      case 3:
        return <Medal className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="w-5 h-5 flex items-center justify-center text-gray-400 text-sm">{rank}</span>;
    }
  };

  const getRankBg = (rank) => {
    switch (rank) {
      case 1:
        return "bg-gradient-to-r from-yellow-500/20 to-amber-500/10 border-yellow-500/30";
      case 2:
        return "bg-gradient-to-r from-gray-400/20 to-gray-500/10 border-gray-400/30";
      case 3:
        return "bg-gradient-to-r from-amber-600/20 to-amber-700/10 border-amber-600/30";
      default:
        return "bg-gray-800/30 border-gray-700/50";
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/3"></div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-700/50 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Flame className="w-5 h-5 text-orange-500" />
        <h3 className="text-lg font-semibold text-white">Streak Leaderboard</h3>
      </div>

      {/* Leaderboard List */}
      {leaderboard.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          <p>No active streaks yet</p>
          <p className="text-sm mt-1">Be the first to start a streak!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leaderboard.map((entry) => (
            <div
              key={entry.user._id}
              className={`flex items-center gap-4 p-3 rounded-lg border ${getRankBg(
                entry.rank
              )} transition-all duration-200 hover:scale-[1.02]`}
            >
              {/* Rank */}
              <div className="flex-shrink-0 w-8">{getRankIcon(entry.rank)}</div>

              {/* User Info */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {entry.user.profileImage ? (
                  <img
                    src={entry.user.profileImage}
                    alt={entry.user.name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                    <User className="w-4 h-4 text-gray-400" />
                  </div>
                )}
                <span className="text-white font-medium truncate">
                  {entry.user.name}
                </span>
              </div>

              {/* Streak */}
              <div className="flex items-center gap-2">
                <Flame
                  className={`w-4 h-4 ${
                    entry.currentStreak >= 30
                      ? "text-purple-500"
                      : entry.currentStreak >= 14
                      ? "text-orange-500"
                      : entry.currentStreak >= 7
                      ? "text-yellow-500"
                      : "text-red-500"
                  }`}
                />
                <span className="text-lg font-bold text-white">
                  {entry.currentStreak}
                </span>
                <span className="text-xs text-gray-400">days</span>
              </div>

              {/* Max Streak Badge */}
              {entry.currentStreak === entry.maxStreak && entry.maxStreak >= 7 && (
                <div className="flex-shrink-0">
                  <span className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded-full">
                    Personal Best!
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-gray-700 text-center">
        <p className="text-xs text-gray-500">
          Solve the daily POTD to climb the leaderboard!
        </p>
      </div>
    </div>
  );
}
