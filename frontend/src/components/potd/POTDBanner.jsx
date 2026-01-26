import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Flame, Clock, ChevronRight, Trophy } from "lucide-react";
import { getTodaysPOTD } from "../../services/potd/potdApi";

export default function POTDBanner() {
  const [potd, setPotd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(null);

  useEffect(() => {
    fetchTodaysPOTD();
  }, []);

  useEffect(() => {
    if (!potd) return;

    const endTime = potd?.potd?.endTime || potd?.endTime;
    if (!endTime) return;

    const now = new Date();
    const end = new Date(endTime);
    const initial = Math.max(0, end - now);
    setTimeRemaining(initial);

    console.log("POTD Timer Debug:", {
      currentTime: now.toISOString(),
      endTime: end.toISOString(),
      remainingMs: initial,
      remainingHours: (initial / (1000 * 60 * 60)).toFixed(2),
    });

    const timer = setInterval(() => {
      const now = new Date();
      const end = new Date(endTime);
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
      console.error("Failed to fetch POTD:", err);
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
        return "#10B981";
      case "Medium":
        return "#F59E0B";
      case "Hard":
        return "#EF4444";
      default:
        return "#6B7280";
    }
  };

  if (loading) {
    return (
      <div
        className="mb-8 rounded-lg p-6 border"
        style={{
          backgroundColor: "rgba(248, 168, 68, 0.05)",
          borderColor: "rgba(248, 168, 68, 0.2)",
        }}
      >
        <div className="h-24 flex items-center justify-center">
          <div className="animate-pulse text-[#A29A8C]">
            Loading Problem of the Day...
          </div>
        </div>
      </div>
    );
  }

  if (!potd) {
    return (
      <div
        className="mb-8 rounded-lg p-6 border"
        style={{
          backgroundColor: "rgba(248, 168, 68, 0.05)",
          borderColor: "rgba(248, 168, 68, 0.2)",
        }}
      >
        <div className="flex items-center gap-3">
          <Flame className="w-6 h-6" style={{ color: "#F8A844" }} />
          <div>
            <h3
              className="text-[#E8E4D9] text-lg font-bold tracking-wider uppercase"
              style={{
                fontFamily: "'Rajdhani', 'Orbitron', system-ui, sans-serif",
              }}
            >
              Problem of the Day
            </h3>
            <p
              className="text-[#A29A8C] text-sm tracking-wide mt-1"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              No challenge scheduled for today. Check back tomorrow!
            </p>
          </div>
        </div>
      </div>
    );
  }

  const problem = potd?.potd?.problem || potd?.problem || null;
  const userProgress = potd?.userProgress || null;

  if (!problem) {
    return (
      <div
        className="mb-8 rounded-lg p-6 border"
        style={{
          backgroundColor: "rgba(248, 168, 68, 0.05)",
          borderColor: "rgba(248, 168, 68, 0.2)",
        }}
      >
        <div className="flex items-center gap-3">
          <Flame className="w-6 h-6" style={{ color: "#F8A844" }} />
          <div>
            <h3
              className="text-[#E8E4D9] text-lg font-bold tracking-wider uppercase"
              style={{
                fontFamily: "'Rajdhani', 'Orbitron', system-ui, sans-serif",
              }}
            >
              Problem of the Day
            </h3>
            <p
              className="text-[#A29A8C] text-sm tracking-wide mt-1"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Problem data unavailable. Please refresh the page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mb-8 rounded-lg p-6 border transition-all duration-300 hover:shadow-lg"
      style={{
        backgroundColor: "rgba(248, 168, 68, 0.08)",
        borderColor: "rgba(248, 168, 68, 0.3)",
      }}
    >
      {}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Flame className="w-6 h-6" style={{ color: "#F8A844" }} />
          <div>
            <h3
              className="text-[#E8E4D9] text-lg font-bold tracking-wider uppercase"
              style={{
                fontFamily: "'Rajdhani', 'Orbitron', system-ui, sans-serif",
              }}
            >
              Problem of the Day
            </h3>
            <p
              className="text-[#A29A8C] text-xs tracking-wide"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Daily Challenge • Build Your Streak
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded"
            style={{ backgroundColor: "rgba(10, 10, 8, 0.6)" }}
          >
            <Clock className="w-4 h-4" style={{ color: "#A29A8C" }} />
            <span
              className="font-mono text-sm"
              style={{ color: "#F8A844", fontFamily: "'Rajdhani', monospace" }}
            >
              {formatTime(timeRemaining)}
            </span>
          </div>

          {}
          {userProgress?.solved && (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded"
              style={{ backgroundColor: "rgba(16, 185, 129, 0.1)" }}
            >
              <Trophy className="w-4 h-4" style={{ color: "#10B981" }} />
              <span
                className="text-sm font-medium"
                style={{ color: "#10B981" }}
              >
                Solved
              </span>
            </div>
          )}
        </div>
      </div>

      {}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <Link to={`/problems/${problem._id}?potd=true`} className="group">
            <h4
              className="text-[#E8E4D9] text-xl font-semibold mb-2 group-hover:text-[#F8A844] transition-colors"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {problem.title}
            </h4>
          </Link>

          <div className="flex items-center gap-3 flex-wrap">
            {}
            <span
              className="px-3 py-1 rounded text-xs font-bold uppercase tracking-wider"
              style={{
                backgroundColor: `${getDifficultyColor(problem.difficulty)}20`,
                color: getDifficultyColor(problem.difficulty),
                fontFamily: "'Rajdhani', system-ui, sans-serif",
              }}
            >
              {problem.difficulty}
            </span>

            {}
            {problem.tags?.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded text-xs tracking-wide"
                style={{
                  backgroundColor: "rgba(162, 154, 140, 0.1)",
                  color: "#A29A8C",
                  fontFamily: "'Rajdhani', system-ui, sans-serif",
                }}
              >
                {tag}
              </span>
            ))}

            {}
            {userProgress &&
              !userProgress.solved &&
              userProgress.attempts > 0 && (
                <span
                  className="text-xs"
                  style={{
                    color: "#A29A8C",
                    fontFamily: "'Rajdhani', system-ui, sans-serif",
                  }}
                >
                  {userProgress.attempts} attempt
                  {userProgress.attempts !== 1 ? "s" : ""}
                </span>
              )}
          </div>
        </div>

        {}
        <Link
          to={`/problems/${problem._id}?potd=true`}
          className="ml-6 flex items-center gap-2 px-6 py-3 rounded transition-all duration-200 group"
          style={{
            backgroundColor: "#F8A844",
            fontFamily: "'Rajdhani', system-ui, sans-serif",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#E69735";
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#F8A844";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <span className="text-[#0A0A08] font-bold uppercase tracking-wider text-sm">
            {userProgress?.solved ? "View Solution" : "Solve Now"}
          </span>
          <ChevronRight className="w-4 h-4 text-[#0A0A08] group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
