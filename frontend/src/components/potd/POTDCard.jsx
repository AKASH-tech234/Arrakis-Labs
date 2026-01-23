import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Flame, Clock, Trophy, ChevronRight, Loader2 } from "lucide-react";
import { getTodaysPOTD } from "../../services/potdApi";

/**
 * POTD Card Component
 * Displays today's Problem of the Day with countdown timer
 */
export default function POTDCard() {
  const [potd, setPotd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);

  useEffect(() => {
    fetchTodaysPOTD();
  }, []);

  useEffect(() => {
    if (!potd) return;

    // Initial calculation
    const now = new Date();
    const end = new Date(potd.potd.endTime);
    const initial = Math.max(0, end - now);
    setTimeRemaining(initial);

    const timer = setInterval(() => {
      const now = new Date();
      const end = new Date(potd.potd.endTime);
      const remaining = Math.max(0, end - now);
      setTimeRemaining(remaining);

      if (remaining === 0) {
        clearInterval(timer);
        fetchTodaysPOTD(); // Refresh when POTD expires
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [potd]);

  const fetchTodaysPOTD = async () => {
    try {
      setLoading(true);
      const response = await getTodaysPOTD();
      if (response.success) {
        setPotd(response.data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (ms) => {
    if (!ms) return "00:00:00";
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case "Easy":
        return "text-green-400 bg-green-400/10";
      case "Medium":
        return "text-yellow-400 bg-yellow-400/10";
      case "Hard":
        return "text-red-400 bg-red-400/10";
      default:
        return "text-gray-400 bg-gray-400/10";
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      </div>
    );
  }

  if (error || !potd) {
    return (
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
        <div className="text-center text-gray-400">
          <p>No Problem of the Day available</p>
          <p className="text-sm mt-2">Check back later!</p>
        </div>
      </div>
    );
  }

  const { problem } = potd.potd;
  const userProgress = potd.userProgress;

  return (
    <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-xl p-6 border border-orange-500/30 hover:border-orange-500/50 transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flame className="w-6 h-6 text-orange-500" />
          <h3 className="text-lg font-bold text-white">Problem of the Day</h3>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <Clock className="w-4 h-4" />
          <span className="text-sm font-mono">{formatTime(timeRemaining)}</span>
        </div>
      </div>

      {/* Problem Info */}
      <div className="mb-4">
        <h4 className="text-xl font-semibold text-white mb-2">{problem.title}</h4>
        <div className="flex items-center gap-3">
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(
              problem.difficulty
            )}`}
          >
            {problem.difficulty}
          </span>
          {problem.tags?.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-1 rounded-full text-xs bg-gray-700 text-gray-300"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* User Progress */}
      {userProgress && (
        <div className="mb-4 p-3 bg-gray-800/50 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Your Progress</span>
            {userProgress.solved ? (
              <span className="flex items-center gap-1 text-green-400 text-sm">
                <Trophy className="w-4 h-4" />
                Solved!
              </span>
            ) : (
              <span className="text-gray-400 text-sm">
                {userProgress.attempts} attempt{userProgress.attempts !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      )}

      {/* CTA Button */}
      <Link
        to={`/problems/${problem._id}?potd=true`}
        className="flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold rounded-lg transition-all duration-300"
      >
        {userProgress?.solved ? "View Solution" : "Solve Now"}
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
