import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import AppHeader from "../../components/layout/AppHeader";
import contestApi from "../../services/contest/contestApi";
import { useAuth } from "../../context/AuthContext";
import { Badge, Button, Card, SectionTitle } from "../../components/ui/ds";

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
        <Badge variant="live" className="animate-pulse">LIVE</Badge>
      );
    }
    if (isUpcoming) {
      return (
        <Badge variant="upcoming">Upcoming</Badge>
      );
    }
    return (
      <Badge variant="ended">Ended</Badge>
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
    <Card
      as={Link}
      to={`/contests/${contest.slug || contest._id}`}
      className="block overflow-hidden group hover:border-[#92400E]/60 transition-colors"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h3
            className="text-xl font-bold tracking-wider text-[#E8E4D9] group-hover:text-[#F59E0B] transition-colors"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {contest.name}
          </h3>
          {getStatusBadge()}
        </div>

        {contest.description && (
          <p
            className="text-[#A29A8C] text-sm mb-4 line-clamp-2"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {contest.description}
          </p>
        )}

        <div
          className="grid grid-cols-2 gap-4 text-sm"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          <div>
            <p className="text-[#78716C] uppercase tracking-wider text-xs">Start Time</p>
            <p className="text-[#E8E4D9]">{formatDate(contest.startTime)}</p>
          </div>
          <div>
            <p className="text-[#78716C] uppercase tracking-wider text-xs">Duration</p>
            <p className="text-[#E8E4D9]">{formatDuration(contest.duration)}</p>
          </div>
        </div>

        {isLive && (
          <div className="mt-4 pt-4 border-t border-[#1A1814]">
            <div className="flex items-center justify-between">
              <span
                className="text-[#A29A8C] text-sm"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                {contest.stats?.participatedCount || 0} participants
              </span>
              <span
                className="text-[#86EFAC] text-sm font-semibold uppercase tracking-wider"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Join Now →
              </span>
            </div>
          </div>
        )}

        {isUpcoming && contest.registration && (
          <div className="mt-4 pt-4 border-t border-[#1A1814]">
            <span
              className="text-[#93C5FD] text-sm font-semibold uppercase tracking-wider"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              ✓ Registered
            </span>
          </div>
        )}
      </div>
    </Card>
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
      <p
        className="text-[#78716C] text-xs uppercase tracking-wider mb-1"
        style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
      >
        Starts in
      </p>
      <p className="text-2xl font-mono font-bold text-[#F59E0B]">{timeLeft}</p>
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0A0A08" }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F59E0B] mx-auto"></div>
          <p
            className="text-[#A29A8C] mt-4 uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Loading contests...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A08" }}>
      <AppHeader />
      <main className="pt-14">
        <div className="max-w-6xl mx-auto px-6 lg:px-12 py-12">
          <SectionTitle
            title="Coding Contests"
            subtitle="Compete with others and improve your skills"
            className="mb-10"
          />

        {}
          {contests.live.length > 0 && (
            <Card className="mb-10 bg-gradient-to-r from-[#1A2A16] to-[#121210]">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-2 h-2 bg-[#EF4444] rounded-full animate-pulse" />
                  <span
                    className="text-[#86EFAC] uppercase tracking-[0.15em] text-xs font-semibold"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    Live Now
                  </span>
                </div>
                <h2
                  className="text-2xl font-bold text-[#E8E4D9] mb-2 tracking-wider"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  {contests.live[0].name}
                </h2>
                <p
                  className="text-[#A29A8C] mb-5"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  {contests.live[0].description}
                </p>
                <Button
                  as={Link}
                  to={`/contests/${contests.live[0].slug || contests.live[0]._id}`}
                  variant="primary"
                  size="lg"
                >
                  Enter Contest →
                </Button>
              </div>
            </Card>
          )}

        {}
          <div className="flex gap-2 mb-8 border-b border-[#1A1814]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-xs uppercase tracking-[0.15em] transition-colors relative ${
                  activeTab === tab.id
                    ? "text-[#F59E0B]"
                    : "text-[#78716C] hover:text-[#E8E4D9]"
                }`}
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span
                    className={`ml-2 px-2 py-0.5 text-[10px] border rounded-none ${
                      activeTab === tab.id
                        ? "bg-[#2A1F0F] text-[#FDE68A] border-[#92400E]"
                        : "bg-[#121210] text-[#A29A8C] border-[#1A1814]"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D97706]"></div>
                )}
              </button>
            ))}
          </div>

        {}
          {error && (
            <Card className="p-4 border-[#7F1D1D] bg-[#2A0F0F] text-[#FCA5A5] mb-8">
              <div style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
                {error}
              </div>
            </Card>
          )}

        {}
          {currentContests.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentContests.map((contest) => (
                <ContestCard key={contest._id} contest={contest} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="text-[#3D3D3D] text-6xl mb-4">🏆</div>
              <h3
                className="text-xl font-semibold text-[#E8E4D9] mb-2 tracking-wider uppercase"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                No {activeTab} contests
              </h3>
              <p
                className="text-[#A29A8C]"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                {activeTab === "upcoming"
                  ? "Check back later for new contests!"
                  : activeTab === "live"
                    ? "No contests are running right now."
                    : "Past contests will appear here."}
              </p>
            </div>
          )}

        {}
          {activeTab === "upcoming" && contests.upcoming.length > 0 && (
            <Card className="mt-10">
              <div className="p-6">
                <h3
                  className="text-lg font-semibold text-[#E8E4D9] mb-4 tracking-wider uppercase"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  Next Contest: {contests.upcoming[0].name}
                </h3>
                <ContestCountdown contest={contests.upcoming[0]} />
              </div>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
