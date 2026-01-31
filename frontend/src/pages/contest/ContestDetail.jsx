import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import AppHeader from "../../components/layout/AppHeader";
import contestApi from "../../services/contest/contestApi";
import { useAuth } from "../../context/AuthContext";
import { useContestTimer, useCountdownTimer } from "../../hooks/contest/useContestTimer";
import useContestWebSocket from "../../hooks/contest/useContestWebSocket";
import { Badge, Button, Card, SectionTitle } from "../../components/ui/ds";

function Timer({ timeLeft, label, variant = 'default' }) {
  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const colors = {
    default: "text-[#E8E4D9]",
    warning: "text-[#FDE68A]",
    danger: "text-[#FCA5A5] animate-pulse",
  };

  return (
    <div className="text-center">
      <p
        className="text-[#78716C] text-xs uppercase tracking-wider mb-1"
        style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
      >
        {label}
      </p>
      <p className={`text-3xl font-mono font-bold ${colors[variant]}`}>
        {formatTime(timeLeft)}
      </p>
    </div>
  );
}

function ProblemList({ problems, contestId, problemStats, userAttempts }) {
  const getDifficultyColor = (difficulty) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      case 'hard': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b border-[#1A1814]">
        <h3
          className="text-lg font-semibold text-[#E8E4D9] tracking-wider uppercase"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          Problems
        </h3>
      </div>
      <div className="divide-y divide-[#1A1814]">
        {problems.map((problem, index) => {
          const attempt = userAttempts?.[problem.id];
          const solveCount = problemStats?.[problem.id] || 0;
          
          return (
            <Link
              key={problem.id}
              to={`/contests/${contestId}/problems/${problem.id}`}
              className="flex items-center justify-between p-4 hover:bg-[#1A1814]/40 transition-colors"
            >
              <div className="flex items-center gap-4">
                <span className="w-8 h-8 flex items-center justify-center bg-[#1A1814] border border-[#1A1814] text-[#E8E4D9] font-mono font-bold">
                  {problem.label}
                </span>
                <div>
                  <h4
                    className="text-[#E8E4D9] font-semibold tracking-wider"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    {problem.title}
                  </h4>
                  <div className="flex items-center gap-3 text-sm mt-1">
                    <span className={getDifficultyColor(problem.difficulty)}>
                      {problem.difficulty}
                    </span>
                    <span className="text-[#3D3D3D]">•</span>
                    <span className="text-[#A29A8C]">{problem.points} pts</span>
                    {solveCount > 0 && (
                      <>
                        <span className="text-[#3D3D3D]">•</span>
                        <span className="text-[#A29A8C]">{solveCount} solves</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {attempt?.solved ? (
                  <Badge variant="success">Solved</Badge>
                ) : attempt?.attempts > 0 ? (
                  <Badge variant="warning">{attempt.attempts} attempts</Badge>
                ) : null}
                <svg className="w-5 h-5 text-[#78716C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

function Leaderboard({ entries, userRank, currentUserId }) {
  if (!entries || entries.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p
          className="text-[#A29A8C]"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          No participants yet
        </p>
      </Card>
    );
  }

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b border-[#1A1814] flex items-center justify-between">
        <h3
          className="text-lg font-semibold text-[#E8E4D9] tracking-wider uppercase"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          Leaderboard
        </h3>
        {userRank && (
          <span
            className="text-sm text-[#A29A8C]"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Your rank: #{userRank}
          </span>
        )}
      </div>
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full">
          <thead className="bg-[#1A1814] sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-[#A29A8C] uppercase tracking-wider">Rank</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-[#A29A8C] uppercase tracking-wider">User</th>
              <th className="px-4 py-3 text-center text-[10px] font-semibold text-[#A29A8C] uppercase tracking-wider">Solved</th>
              <th className="px-4 py-3 text-right text-[10px] font-semibold text-[#A29A8C] uppercase tracking-wider">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1A1814]">
            {entries.map((entry) => (
              <tr 
                key={entry.userId}
                className={entry.userId === currentUserId ? "bg-[#2A1F0F]" : "hover:bg-[#1A1814]/40"}
              >
                <td className="px-4 py-3 text-sm">
                  {entry.rank <= 3 ? (
                    <span className={`text-lg ${
                      entry.rank === 1 ? 'text-yellow-400' :
                      entry.rank === 2 ? 'text-gray-300' :
                      'text-orange-400'
                    }`}>
                      {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                    </span>
                  ) : (
                    <span className="text-[#A29A8C]">{entry.rank}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {entry.profileImage ? (
                      <img 
                        src={entry.profileImage} 
                        alt="" 
                        className="w-6 h-6 rounded-full"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-[#1A1814] border border-[#1A1814] flex items-center justify-center text-xs text-[#A29A8C]">
                        {entry.username?.[0]?.toUpperCase()}
                      </div>
                    )}
                    <span className={entry.userId === currentUserId ? "text-[#F59E0B] font-semibold" : "text-[#E8E4D9]"}>
                      {entry.username}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-[#86EFAC] font-semibold">{entry.problemsSolved}</span>
                </td>
                <td className="px-4 py-3 text-right text-sm text-[#A29A8C]">
                  {formatTime(entry.totalTime)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Announcements({ announcements }) {
  if (!announcements || announcements.length === 0) return null;

  return (
    <div className="mb-6 space-y-2">
      {announcements.map((announcement) => (
        <div
          key={announcement.id}
          className={`p-4 rounded-lg ${
            announcement.priority === 'high'
              ? 'bg-[#2A0F0F] border border-[#7F1D1D]'
              : 'bg-[#2A1F0F] border border-[#92400E]'
          }`}
        >
          <p
            className={announcement.priority === "high" ? "text-[#FCA5A5]" : "text-[#FDE68A]"}
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            📢 {announcement.message}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function ContestDetail() {
  const { contestId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const [contest, setContest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [registering, setRegistering] = useState(false);
  const [joining, setJoining] = useState(false);

  const wsContestId = contest?.isLive ? contest?.id : null;

  const {
    isConnected,
    leaderboard: wsLeaderboard,
    participantCount,
    announcements,
    serverTime,
  } = useContestWebSocket(wsContestId, {
    token,
    onContestStart: () => {
      
      fetchContest();
    },
    onContestEnd: () => {
      fetchContest();
    },
  });

  const { formattedCountdown, hasStarted } = useCountdownTimer(
    contest?.startTime,
    { serverTime, onStart: () => fetchContest() }
  );

  const { timeLeft, isEnded } = useContestTimer(
    contest?.endTime,
    { serverTime, onEnd: () => fetchContest() }
  );

  const fetchContest = useCallback(async () => {
    try {
      setLoading(true);
      const response = await contestApi.getContest(contestId);
      setContest(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load contest');
    } finally {
      setLoading(false);
    }
  }, [contestId]);

  useEffect(() => {
    fetchContest();
  }, [fetchContest]);

  const handleRegister = async () => {
    if (!user) {
      navigate('/login', { state: { from: `/contests/${contestId}` } });
      return;
    }

    try {
      setRegistering(true);
      await contestApi.registerForContest(contestId);
      fetchContest();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to register');
    } finally {
      setRegistering(false);
    }
  };

  const handleJoin = async () => {
    if (!user) {
      navigate('/login', { state: { from: `/contests/${contestId}` } });
      return;
    }

    try {
      setJoining(true);
      await contestApi.joinContest(contestId);
      fetchContest();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0A0A08" }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F59E0B] mx-auto"></div>
          <p
            className="text-[#A29A8C] mt-4 uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Loading contest...
          </p>
        </div>
      </div>
    );
  }

  if (error && !contest) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0A0A08" }}>
        <div className="text-center">
          <div className="text-[#FCA5A5] text-6xl mb-4">⚠️</div>
          <h2
            className="text-xl font-semibold text-[#E8E4D9] mb-2 tracking-wider uppercase"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Error
          </h2>
          <p
            className="text-[#A29A8C]"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {error}
          </p>
          <Button as={Link} to="/contests" variant="secondary" size="md" className="mt-6">
            ← Back to contests
          </Button>
        </div>
      </div>
    );
  }

  const isUpcoming = contest?.isUpcoming;
  const isLive = contest?.isLive;
  const hasEnded = contest?.hasEnded;
  const isRegistered = !!contest?.registration;
  const isParticipating = contest?.registration?.status === 'participating';

  const getTimerVariant = () => {
    if (timeLeft <= 300) return 'danger'; 
    if (timeLeft <= 900) return 'warning'; 
    return 'default';
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A08" }}>
      <AppHeader />
      <main className="pt-14">
        <div className="max-w-6xl mx-auto px-6 lg:px-12 py-12">
          <div className="mb-8">
            <Button as={Link} to="/contests" variant="ghost" size="sm" className="mb-6">
              ← Back to contests
            </Button>

            <div className="flex items-start justify-between gap-6">
              <SectionTitle
                title={contest?.name}
                subtitle={contest?.description || ""}
              />

              <div className="text-right">
                {isLive && (
                  <div className="flex items-center justify-end gap-3 mb-2">
                    <span className="w-2 h-2 bg-[#EF4444] rounded-full animate-pulse" />
                    <Badge variant="live" className="animate-pulse">LIVE</Badge>
                    {isConnected && (
                      <span
                        className="text-[#A29A8C] text-xs uppercase tracking-wider"
                        style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                      >
                        • {participantCount} online
                      </span>
                    )}
                  </div>
                )}
                {isUpcoming && <Badge variant="upcoming">Upcoming</Badge>}
                {hasEnded && <Badge variant="ended">Ended</Badge>}
              </div>
            </div>
          </div>

        {}
        <Announcements announcements={announcements} />

        {}
          {error && (
            <Card className="mb-8 p-4 border-[#7F1D1D] bg-[#2A0F0F] text-[#FCA5A5]">
              <div style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>{error}</div>
            </Card>
          )}

        {}
          {isUpcoming && (
            <div className="mb-10">
              <Card className="p-10 text-center">
                <h2
                  className="text-lg font-semibold text-[#E8E4D9] mb-4 tracking-wider uppercase"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  Contest starts in
                </h2>
                <div className="text-5xl font-mono font-bold text-[#F59E0B] mb-8">{formattedCountdown}</div>

                {!isRegistered ? (
                  <Button
                    onClick={handleRegister}
                    disabled={registering}
                    variant="primary"
                    size="lg"
                  >
                    {registering ? "Registering..." : "Register for Contest"}
                  </Button>
                ) : (
                  <div className="text-[#86EFAC]">
                    ✓ You are registered
                    <p
                      className="text-[#A29A8C] text-sm mt-2"
                      style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                    >
                      Come back when the contest starts
                    </p>
                  </div>
                )}
              </Card>
            </div>
          )}

        {}
          {isLive && (
            <>
              <Card className="mb-8 p-4">
                <div className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-6">
                    <Timer timeLeft={timeLeft} label="Time Remaining" variant={getTimerVariant()} />
                  </div>

                  {!isParticipating ? (
                    <Button onClick={handleJoin} disabled={joining} variant="primary" size="md">
                      {joining ? "Joining..." : "Join Contest"}
                    </Button>
                  ) : (
                    <Badge variant="success">Participating</Badge>
                  )}
                </div>
              </Card>

            {}
            <div className="grid lg:grid-cols-3 gap-6">
              {}
              <div className="lg:col-span-2">
                {contest?.problems?.length > 0 ? (
                  <ProblemList
                    problems={contest.problems}
                    contestId={contestId}
                    problemStats={contest.problemStats}
                    userAttempts={Object.fromEntries(
                      contest.registration?.problemAttempts || []
                    )}
                  />
                ) : (
                  <Card className="p-8 text-center">
                    <p
                      className="text-[#A29A8C]"
                      style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                    >
                      Problems will appear when you join
                    </p>
                  </Card>
                )}
              </div>

              {}
              <div>
                {contest.showLeaderboardDuringContest && (
                  <Leaderboard
                    entries={wsLeaderboard.length > 0 ? wsLeaderboard : []}
                    userRank={contest.registration?.rank}
                    currentUserId={user?._id}
                  />
                )}
              </div>
            </div>
          </>
        )}

        {}
          {hasEnded && (
            <div className="space-y-6">
            {}
            {contest.registration && (
              <Card className="p-6">
                <h2
                  className="text-xl font-semibold text-[#E8E4D9] mb-4 tracking-wider uppercase"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  Your Result
                </h2>
                <div className="grid grid-cols-4 gap-6 text-center">
                  <div>
                    <p className="text-3xl font-bold text-[#F59E0B]">
                      #{contest.registration.finalRank || '-'}
                    </p>
                    <p className="text-[#78716C] text-xs uppercase tracking-wider" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>Final Rank</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-[#86EFAC]">
                      {contest.registration.problemsSolved || 0}
                    </p>
                    <p className="text-[#78716C] text-xs uppercase tracking-wider" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>Problems Solved</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-[#E8E4D9]">
                      {contest.registration.finalScore || 0}
                    </p>
                    <p className="text-[#78716C] text-xs uppercase tracking-wider" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>Total Score</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-[#A29A8C]">
                      {Math.floor(contest.registration.totalTime / 60)}m
                    </p>
                    <p className="text-[#78716C] text-xs uppercase tracking-wider" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>Total Time</p>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-[#1A1814]">
                  <Button as={Link} to={`/contests/${contestId}/analytics`} variant="ghost" size="sm">
                    View detailed analytics →
                  </Button>
                </div>
              </Card>
            )}

            {}
            {contest?.problems?.length > 0 && (
              <ProblemList
                problems={contest.problems}
                contestId={contestId}
                problemStats={contest.problemStats}
              />
            )}

            {}
              {contest.editorial && (
                <Card className="p-6">
                  <h2
                    className="text-xl font-semibold text-[#E8E4D9] mb-4 tracking-wider uppercase"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    Editorial
                  </h2>
                  <div className="prose prose-invert max-w-none">{contest.editorial}</div>
                </Card>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
