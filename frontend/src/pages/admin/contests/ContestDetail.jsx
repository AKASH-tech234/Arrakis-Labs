import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import adminApi from '../../../services/adminApi';

/**
 * Admin Contest Detail View
 * View contest details, participants, submissions, send announcements
 */

export default function ContestDetail() {
  const { id } = useParams();
  const [contest, setContest] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [announcement, setAnnouncement] = useState('');
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);

  useEffect(() => {
    fetchContestData();
  }, [id]);

  const fetchContestData = async () => {
    try {
      setLoading(true);
      const [contestRes, participantsRes] = await Promise.all([
        adminApi.get(`/contests/${id}`),
        adminApi.get(`/contests/${id}/participants`),
      ]);
      
      setContest(contestRes.data.data);
      setParticipants(participantsRes.data.data || []);
      setLeaderboard(participantsRes.data.data?.filter(p => p.totalScore > 0) || []);
    } catch (err) {
      console.error('Failed to fetch contest:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendAnnouncement = async () => {
    if (!announcement.trim()) return;
    
    try {
      setSendingAnnouncement(true);
      await adminApi.post(`/contests/${id}/announce`, { message: announcement });
      setAnnouncement('');
      alert('Announcement sent successfully!');
    } catch (err) {
      alert('Failed to send announcement: ' + (err.response?.data?.message || err.message));
    } finally {
      setSendingAnnouncement(false);
    }
  };

  const handleForceEnd = async () => {
    if (!confirm('Are you sure you want to force end this contest? This action cannot be undone.')) {
      return;
    }
    
    try {
      await adminApi.post(`/contests/${id}/end`);
      fetchContestData();
    } catch (err) {
      alert('Failed to end contest: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleExtendTime = async () => {
    const minutes = prompt('Enter additional minutes to extend:');
    if (!minutes || isNaN(minutes)) return;
    
    try {
      await adminApi.put(`/contests/${id}` , {
        duration: contest.duration + parseInt(minutes),
      });
      fetchContestData();
    } catch (err) {
      alert('Failed to extend time: ' + (err.response?.data?.message || err.message));
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-500',
      scheduled: 'bg-blue-500',
      live: 'bg-green-500',
      ended: 'bg-red-500',
      cancelled: 'bg-gray-600',
    };
    return colors[status] || 'bg-gray-500';
  };

  const formatDateTime = (date) => {
    return new Date(date).toLocaleString();
  };

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!contest) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400">Contest not found</p>
        <Link to="/admin/contests" className="text-blue-400 hover:underline mt-2 inline-block">
          Back to contests
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            to="/admin/contests"
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{contest.name}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${getStatusColor(contest.status)}`}>
                {contest.status.toUpperCase()}
              </span>
            </div>
            <p className="text-gray-400 mt-1">{contest.description || 'No description'}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {contest.status === 'live' && (
            <>
              <button
                onClick={handleExtendTime}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm"
              >
                Extend Time
              </button>
              <button
                onClick={handleForceEnd}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
              >
                Force End
              </button>
            </>
          )}
          <Link
            to={`/admin/contests/${id}/edit`}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
          >
            Edit Contest
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <p className="text-gray-400 text-sm">Participants</p>
          <p className="text-2xl font-bold text-white">{participants.length}</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <p className="text-gray-400 text-sm">Problems</p>
          <p className="text-2xl font-bold text-white">{contest.problems?.length || 0}</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <p className="text-gray-400 text-sm">Duration</p>
          <p className="text-2xl font-bold text-white">{formatDuration(contest.duration)}</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <p className="text-gray-400 text-sm">Start Time</p>
          <p className="text-lg font-semibold text-white">{formatDateTime(contest.startTime)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-700 mb-6">
        <div className="flex gap-4">
          {['overview', 'participants', 'leaderboard', 'announcements'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 font-medium text-sm border-b-2 -mb-px transition-colors ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Contest Info */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Contest Settings</h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-gray-400">Ranking Type</dt>
                <dd className="text-white">{contest.rankingType?.toUpperCase()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">Wrong Submission Penalty</dt>
                <dd className="text-white">{contest.penaltyRules?.wrongSubmissionPenalty} min</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">Public</dt>
                <dd className="text-white">{contest.isPublic ? 'Yes' : 'No'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">Registration Required</dt>
                <dd className="text-white">{contest.requiresRegistration ? 'Yes' : 'No'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">Late Join Allowed</dt>
                <dd className="text-white">{contest.allowLateJoin ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
          </div>

          {/* Problems */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Problems</h3>
            <div className="space-y-2">
              {contest.problems?.map((p) => (
                <div key={p._id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 flex items-center justify-center bg-blue-600 rounded text-white font-bold">
                      {p.label}
                    </span>
                    <span className="text-white">{p.problem?.title || 'Unknown'}</span>
                  </div>
                  <span className="text-gray-400">{p.points} pts</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'participants' && (
        <div className="bg-gray-800 rounded-lg border border-gray-700">
          <table className="w-full">
            <thead className="border-b border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">#</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">User</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Registered</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Joined</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Score</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Rank</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {participants.map((p, idx) => (
                <tr key={p._id} className="hover:bg-gray-700/50">
                  <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                  <td className="px-4 py-3 text-white">{p.user?.username || 'Unknown'}</td>
                  <td className="px-4 py-3 text-gray-400">{formatDateTime(p.registeredAt)}</td>
                  <td className="px-4 py-3 text-gray-400">
                    {p.joinedAt ? formatDateTime(p.joinedAt) : '-'}
                  </td>
                  <td className="px-4 py-3 text-white">{p.totalScore}</td>
                  <td className="px-4 py-3 text-white">{p.finalRank || '-'}</td>
                </tr>
              ))}
              {participants.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No participants yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'leaderboard' && (
        <div className="bg-gray-800 rounded-lg border border-gray-700">
          <table className="w-full">
            <thead className="border-b border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Rank</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">User</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Score</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Penalty</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Problems</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {leaderboard
                .sort((a, b) => b.totalScore - a.totalScore || a.totalPenalty - b.totalPenalty)
                .map((p, idx) => (
                  <tr key={p._id} className="hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-white font-medium">
                      {idx + 1}
                      {idx === 0 && <span className="ml-1">🥇</span>}
                      {idx === 1 && <span className="ml-1">🥈</span>}
                      {idx === 2 && <span className="ml-1">🥉</span>}
                    </td>
                    <td className="px-4 py-3 text-white">{p.user?.username || 'Unknown'}</td>
                    <td className="px-4 py-3 text-green-400 font-medium">{p.totalScore}</td>
                    <td className="px-4 py-3 text-red-400">{p.totalPenalty} min</td>
                    <td className="px-4 py-3 text-gray-400">
                      {p.problemsAttempted?.size || 0} solved
                    </td>
                  </tr>
                ))}
              {leaderboard.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No scores yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'announcements' && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Send Announcement</h3>
          <p className="text-gray-400 text-sm mb-4">
            Send a real-time announcement to all participants in this contest.
          </p>
          <textarea
            value={announcement}
            onChange={(e) => setAnnouncement(e.target.value)}
            placeholder="Type your announcement message..."
            rows={4}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 resize-none mb-4"
          />
          <button
            onClick={handleSendAnnouncement}
            disabled={sendingAnnouncement || !announcement.trim()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
          >
            {sendingAnnouncement ? 'Sending...' : 'Send Announcement'}
          </button>
        </div>
      )}
    </div>
  );
}
