import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import contestApi from '../../services/contest/contestApi';
import { useAuth } from '../../context/AuthContext';
import { useContestTimer, useCountdownTimer } from '../../hooks/contest/useContestTimer';
import useContestWebSocket from '../../hooks/contest/useContestWebSocket';

/**
 * Contest Detail/Lobby Page
 * Pre-contest: Registration & countdown
 * During: Problem list & navigation to problems
 * Post: Results & analytics
 */

function Timer({ timeLeft, label, variant = 'default' }) {
  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const colors = {
    default: 'text-white',
    warning: 'text-yellow-400',
    danger: 'text-red-400 animate-pulse',
  };

  return (
    <div className="text-center">
      <p className="text-gray-500 text-sm mb-1">{label}</p>
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
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white">Problems</h3>
      </div>
      <div className="divide-y divide-gray-700">
        {problems.map((problem, index) => {
          const attempt = userAttempts?.[problem.id];
          const solveCount = problemStats?.[problem.id] || 0;
          
          return (
            <Link
              key={problem.id}
              to={`/contests/${contestId}/problems/${problem.id}`}
              className="flex items-center justify-between p-4 hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <span className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded text-gray-300 font-mono font-bold">
                  {problem.label}
                </span>
                <div>
                  <h4 className="text-white font-medium">{problem.title}</h4>
                  <div className="flex items-center gap-3 text-sm mt-1">
                    <span className={getDifficultyColor(problem.difficulty)}>
                      {problem.difficulty}
                    </span>
                    <span className="text-gray-500">•</span>
                    <span className="text-gray-400">{problem.points} pts</span>
                    {solveCount > 0 && (
                      <>
                        <span className="text-gray-500">•</span>
                        <span className="text-gray-400">{solveCount} solves</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {attempt?.solved ? (
                  <span className="px-3 py-1 bg-green-500/20 text-green-400 text-sm rounded-full">
                    ✓ Solved
                  </span>
                ) : attempt?.attempts > 0 ? (
                  <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-sm rounded-full">
                    {attempt.attempts} attempts
                  </span>
                ) : null}
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Leaderboard({ entries, userRank, currentUserId }) {
  if (!entries || entries.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 text-center">
        <p className="text-gray-400">No participants yet</p>
      </div>
    );
  }

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Leaderboard</h3>
        {userRank && (
          <span className="text-sm text-gray-400">Your rank: #{userRank}</span>
        )}
      </div>
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full">
          <thead className="bg-gray-700/50 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Rank</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">User</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Solved</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {entries.map((entry) => (
              <tr 
                key={entry.userId}
                className={entry.userId === currentUserId ? 'bg-blue-500/10' : 'hover:bg-gray-700/50'}
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
                    <span className="text-gray-400">{entry.rank}</span>
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
                      <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-xs text-gray-300">
                        {entry.username?.[0]?.toUpperCase()}
                      </div>
                    )}
                    <span className={entry.userId === currentUserId ? 'text-blue-400 font-medium' : 'text-white'}>
                      {entry.username}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-green-400 font-medium">{entry.problemsSolved}</span>
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-400">
                  {formatTime(entry.totalTime)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
              ? 'bg-red-500/20 border border-red-500/30'
              : 'bg-blue-500/20 border border-blue-500/30'
          }`}
        >
          <p className={announcement.priority === 'high' ? 'text-red-300' : 'text-blue-300'}>
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

  // WebSocket rooms use the real contest id (not slug)
  // to match Redis leaderboard keys and backend notifications.
  const wsContestId = contest?.isLive ? contest?.id : null;

  // WebSocket for real-time updates
  const {
    isConnected,
    leaderboard: wsLeaderboard,
    participantCount,
    announcements,
    serverTime,
  } = useContestWebSocket(wsContestId, {
    token,
    onContestStart: () => {
      // Refresh contest data
      fetchContest();
    },
    onContestEnd: () => {
      fetchContest();
    },
  });


  // Timers
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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-400 mt-4">Loading contest...</p>
        </div>
      </div>
    );
  }

  if (error && !contest) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-medium text-white mb-2">Error</h2>
          <p className="text-gray-400">{error}</p>
          <Link to="/contests" className="mt-4 inline-block text-blue-400 hover:underline">
            ← Back to contests
          </Link>
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
    if (timeLeft <= 300) return 'danger'; // 5 minutes
    if (timeLeft <= 900) return 'warning'; // 15 minutes
    return 'default';
  };

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <Link to="/contests" className="text-blue-400 hover:underline text-sm mb-2 inline-block">
            ← Back to contests
          </Link>
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{contest?.name}</h1>
              {contest?.description && (
                <p className="text-gray-400">{contest.description}</p>
              )}
            </div>
            
            <div className="text-right">
              {isLive && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                  <span className="text-green-400 font-semibold">LIVE</span>
                  {isConnected && (
                    <span className="text-gray-500 text-sm">• {participantCount} online</span>
                  )}
                </div>
              )}
              {isUpcoming && (
                <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">
                  Upcoming
                </span>
              )}
              {hasEnded && (
                <span className="px-3 py-1 bg-gray-500/20 text-gray-400 rounded-full text-sm">
                  Ended
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Announcements */}
        <Announcements announcements={announcements} />

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Pre-contest: Countdown & Registration */}
        {isUpcoming && (
          <div className="mb-8">
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 text-center">
              <h2 className="text-xl font-medium text-white mb-6">Contest starts in</h2>
              <div className="text-5xl font-mono font-bold text-blue-400 mb-8">
                {formattedCountdown}
              </div>
              
              {!isRegistered ? (
                <button
                  onClick={handleRegister}
                  disabled={registering}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                >
                  {registering ? 'Registering...' : 'Register for Contest'}
                </button>
              ) : (
                <div className="text-green-400">
                  ✓ You are registered
                  <p className="text-gray-500 text-sm mt-2">
                    Come back when the contest starts
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Live Contest */}
        {isLive && (
          <>
            {/* Timer Bar */}
            <div className="mb-6 bg-gray-800 rounded-lg border border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Timer 
                    timeLeft={timeLeft} 
                    label="Time Remaining" 
                    variant={getTimerVariant()}
                  />
                </div>
                
                {!isParticipating ? (
                  <button
                    onClick={handleJoin}
                    disabled={joining}
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                  >
                    {joining ? 'Joining...' : 'Join Contest'}
                  </button>
                ) : (
                  <span className="text-green-400 text-sm">✓ Participating</span>
                )}
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Problems */}
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
                  <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 text-center">
                    <p className="text-gray-400">Problems will appear when you join</p>
                  </div>
                )}
              </div>

              {/* Leaderboard */}
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

        {/* Post-contest */}
        {hasEnded && (
          <div className="space-y-6">
            {/* Final Standing */}
            {contest.registration && (
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Your Result</h2>
                <div className="grid grid-cols-4 gap-6 text-center">
                  <div>
                    <p className="text-3xl font-bold text-blue-400">
                      #{contest.registration.finalRank || '-'}
                    </p>
                    <p className="text-gray-500 text-sm">Final Rank</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-green-400">
                      {contest.registration.problemsSolved || 0}
                    </p>
                    <p className="text-gray-500 text-sm">Problems Solved</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-white">
                      {contest.registration.finalScore || 0}
                    </p>
                    <p className="text-gray-500 text-sm">Total Score</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-gray-400">
                      {Math.floor(contest.registration.totalTime / 60)}m
                    </p>
                    <p className="text-gray-500 text-sm">Total Time</p>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <Link
                    to={`/contests/${contestId}/analytics`}
                    className="text-blue-400 hover:underline"
                  >
                    View detailed analytics →
                  </Link>
                </div>
              </div>
            )}

            {/* Problems with solutions */}
            {contest?.problems?.length > 0 && (
              <ProblemList
                problems={contest.problems}
                contestId={contestId}
                problemStats={contest.problemStats}
              />
            )}

            {/* Editorial */}
            {contest.editorial && (
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Editorial</h2>
                <div className="prose prose-invert max-w-none">
                  {contest.editorial}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
