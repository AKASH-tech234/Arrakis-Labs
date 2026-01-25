import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import contestApi from '../../services/contest/contestApi';
import { useAuth } from '../../context/AuthContext';

/**
 * Contest List Page
 * Shows upcoming, live, and past contests
 */

function ContestCard({ contest }) {
  const now = new Date();
  const startTime = new Date(contest.startTime);
  const endTime = new Date(contest.endTime);
  
  const isUpcoming = now < startTime;
  const isLive = now >= startTime && now < endTime;
  const isPast = now >= endTime;

  const getStatusBadge = () => {
    if (isLive) {
      return (
        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-500/20 text-green-400 animate-pulse">
          🔴 LIVE
        </span>
      );
    }
    if (isUpcoming) {
      return (
        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-400">
          Upcoming
        </span>
      );
    }
    return (
      <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-500/20 text-gray-400">
        Ended
      </span>
    );
  };

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(new Date(date));
  };

  const formatDuration = (minutes) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins > 0 ? `${mins}m` : ''}`;
    }
    return `${mins}m`;
  };

  return (
    <Link
      to={`/contests/${contest.slug || contest._id}`}
      className="block bg-gray-800 rounded-lg border border-gray-700 hover:border-blue-500 transition-all duration-200 overflow-hidden group"
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
            {contest.name}
          </h3>
          {getStatusBadge()}
        </div>

        {contest.description && (
          <p className="text-gray-400 text-sm mb-4 line-clamp-2">
            {contest.description}
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Start Time</p>
            <p className="text-gray-300">{formatDate(contest.startTime)}</p>
          </div>
          <div>
            <p className="text-gray-500">Duration</p>
            <p className="text-gray-300">{formatDuration(contest.duration)}</p>
          </div>
        </div>

        {isLive && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">
                {contest.stats?.participatedCount || 0} participants
              </span>
              <span className="text-green-400 text-sm font-medium">
                Join Now →
              </span>
            </div>
          </div>
        )}

        {isUpcoming && contest.registration && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <span className="text-blue-400 text-sm">
              ✓ Registered
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

function ContestCountdown({ contest }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const start = new Date(contest.startTime);
      const diff = start - now;

      if (diff <= 0) {
        setTimeLeft('Started!');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${minutes}m ${seconds}s`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [contest.startTime]);

  return (
    <div className="text-center">
      <p className="text-gray-500 text-sm mb-1">Starts in</p>
      <p className="text-2xl font-mono font-bold text-blue-400">{timeLeft}</p>
    </div>
  );
}

export default function ContestList() {
  const { user } = useAuth();
  const [contests, setContests] = useState({
    live: [],
    upcoming: [],
    past: [],
  });
  const [activeTab, setActiveTab] = useState('upcoming');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchContests = async () => {
      try {
        setLoading(true);
        
        const [liveRes, upcomingRes, pastRes] = await Promise.all([
          contestApi.getContests({ status: 'live', limit: 10 }),
          contestApi.getContests({ status: 'upcoming', limit: 20 }),
          contestApi.getContests({ status: 'past', limit: 20 }),
        ]);

        setContests({
          live: liveRes.data || [],
          upcoming: upcomingRes.data || [],
          past: pastRes.data || [],
        });

        // Auto-select tab based on available contests
        if (liveRes.data?.length > 0) {
          setActiveTab('live');
        } else if (upcomingRes.data?.length > 0) {
          setActiveTab('upcoming');
        }
      } catch (err) {
        setError(err.message || 'Failed to load contests');
      } finally {
        setLoading(false);
      }
    };

    fetchContests();
  }, []);

  const tabs = [
    { id: 'live', label: 'Live', count: contests.live.length },
    { id: 'upcoming', label: 'Upcoming', count: contests.upcoming.length },
    { id: 'past', label: 'Past', count: contests.past.length },
  ];

  const currentContests = contests[activeTab] || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-400 mt-4">Loading contests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Coding Contests</h1>
          <p className="text-gray-400">
            Compete with others and improve your coding skills
          </p>
        </div>

        {/* Featured Live Contest */}
        {contests.live.length > 0 && (
          <div className="mb-8 p-6 bg-gradient-to-r from-green-900/50 to-blue-900/50 rounded-lg border border-green-500/30">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
              <span className="text-green-400 font-semibold">Live Now</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {contests.live[0].name}
            </h2>
            <p className="text-gray-300 mb-4">{contests.live[0].description}</p>
            <Link
              to={`/contests/${contests.live[0].slug || contests.live[0]._id}`}
              className="inline-block px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
            >
              Enter Contest →
            </Link>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-medium text-sm transition-colors relative ${
                activeTab === tab.id
                  ? 'text-blue-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                  activeTab === tab.id
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-gray-700 text-gray-400'
                }`}>
                  {tab.count}
                </span>
              )}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
              )}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 mb-6">
            {error}
          </div>
        )}

        {/* Contest Grid */}
        {currentContests.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentContests.map((contest) => (
              <ContestCard key={contest._id} contest={contest} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-500 text-6xl mb-4">🏆</div>
            <h3 className="text-xl font-medium text-gray-300 mb-2">
              No {activeTab} contests
            </h3>
            <p className="text-gray-500">
              {activeTab === 'upcoming'
                ? 'Check back later for new contests!'
                : activeTab === 'live'
                ? 'No contests are running right now.'
                : 'Past contests will appear here.'}
            </p>
          </div>
        )}

        {/* Next upcoming contest countdown */}
        {activeTab === 'upcoming' && contests.upcoming.length > 0 && (
          <div className="mt-8 p-6 bg-gray-800 rounded-lg border border-gray-700">
            <h3 className="text-lg font-medium text-white mb-4">
              Next Contest: {contests.upcoming[0].name}
            </h3>
            <ContestCountdown contest={contests.upcoming[0]} />
          </div>
        )}
      </div>
    </div>
  );
}
