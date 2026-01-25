import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Flame, Clock, Trophy, ChevronRight, Loader2 } from "lucide-react";
import { getTodaysPOTD } from "../../services/potd/potdApi";

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
        fetchTodaysPOTD(); 
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
      <div className="rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-5">
        <div className="flex items-center justify-center h-24">
          <Loader2 className="w-6 h-6 animate-spin text-[#D97706]" />
        </div>
      </div>
    );
  }

  if (error || !potd) {
    return (
      <div className="rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-5">
        <div className="text-center text-[#78716C]">
          <p className="text-sm">No Problem of the Day available</p>
          <p className="text-xs mt-1">Check back later!</p>
        </div>
      </div>
    );
  }

  const { problem } = potd.potd;
  const userProgress = potd.userProgress;

  return (
    <div className="rounded-xl border border-[#1A1814] bg-[#0F0F0D] hover:border-[#D97706]/40 transition-all duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#1A1814]">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-[#D97706]" />
          <span
            className="text-[#E8E4D9] text-sm font-semibold uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Today's Challenge
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[#78716C]">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-xs font-mono">{formatTime(timeRemaining)}</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h4
          className="text-lg font-semibold text-[#E8E4D9] mb-3"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          {problem.title}
        </h4>
        
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${getDifficultyColor(problem.difficulty)}`}
          >
            {problem.difficulty}
          </span>
          {problem.tags?.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded text-xs bg-[#1A1814] text-[#78716C]"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Progress */}
        {userProgress && (
          <div className="flex items-center justify-between p-2.5 bg-[#0A0A08] rounded-lg mb-4">
            <span className="text-xs text-[#78716C]">Your Progress</span>
            {userProgress.solved ? (
              <span className="flex items-center gap-1 text-green-400 text-xs font-medium">
                <Trophy className="w-3.5 h-3.5" />
                Solved
              </span>
            ) : (
              <span className="text-[#78716C] text-xs">
                {userProgress.attempts} attempt{userProgress.attempts !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        {/* CTA */}
        <Link
          to={`/problems/${problem._id}?potd=true`}
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#D97706] hover:bg-[#F59E0B] text-[#0A0A08] font-semibold text-sm rounded-lg transition-colors duration-200"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          {userProgress?.solved ? "View Solution" : "Solve Now"}
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
