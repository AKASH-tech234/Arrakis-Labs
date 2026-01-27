import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import adminApi from '../../../services/admin/adminApi';
import {
  ArrowLeft,
  Users,
  Clock,
  Calendar,
  Award,
  Edit,
  Loader2,
  Send,
  Trophy,
  AlertTriangle,
} from 'lucide-react';

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
      draft: 'bg-[#78716C]/10 text-[#78716C] border border-[#78716C]/20',
      scheduled: 'bg-[#D97706]/10 text-[#D97706] border border-[#D97706]/20',
      live: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      ended: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
      cancelled: 'bg-red-500/10 text-red-400 border border-red-500/20',
    };
    return colors[status] || 'bg-[#78716C]/10 text-[#78716C] border border-[#78716C]/20';
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
      <div className="flex flex-col items-center justify-center py-20">
        <div className="p-4 rounded-xl bg-[#0F0F0D] border border-[#1A1814]">
          <Loader2 className="h-8 w-8 animate-spin text-[#D97706]" />
        </div>
        <p className="text-[#78716C] mt-4 text-sm uppercase tracking-wider" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
          Loading contest...
        </p>
      </div>
    );
  }

  if (!contest) {
    return (
      <div className="py-12 text-center" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
        <p className="text-[#78716C]">Contest not found</p>
        <Link to="/admin/contests" className="text-[#D97706] hover:text-[#F59E0B] mt-2 inline-block">
          Back to contests
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <Link
            to="/admin/contests"
            className="p-2.5 rounded-lg border border-[#1A1814] bg-[#0F0F0D] hover:border-[#D97706]/40 text-[#78716C] hover:text-[#D97706] transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 bg-gradient-to-b from-[#D97706] to-transparent rounded-full" />
              <h1 className="text-2xl font-bold text-[#E8E4D9] tracking-wide">{contest.name}</h1>
              <span className={`px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider ${getStatusColor(contest.status)}`}>
                {contest.status === 'live' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />}
                {contest.status}
              </span>
            </div>
            <p className="text-[#78716C] mt-1 ml-3 text-sm">{contest.description || 'No description'}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {contest.status === 'live' && (
            <>
              <button
                onClick={handleExtendTime}
                className="px-4 py-2 rounded-lg bg-[#D97706]/10 border border-[#D97706]/20 text-[#D97706] hover:bg-[#D97706]/20 text-sm font-semibold uppercase tracking-wider transition-all"
              >
                Extend Time
              </button>
              <button
                onClick={handleForceEnd}
                className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-sm font-semibold uppercase tracking-wider transition-all"
              >
                Force End
              </button>
            </>
          )}
          <Link
            to={`/admin/contests/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#D97706] to-[#F59E0B] hover:from-[#B45309] hover:to-[#D97706] text-white text-sm font-semibold uppercase tracking-wider transition-all"
          >
            <Edit className="w-4 h-4" />
            Edit Contest
          </Link>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <div className="p-5 rounded-xl bg-[#0A0A08] border border-[#1A1814]">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-[#D97706]/10">
              <Users className="w-4 h-4 text-[#D97706]" />
            </div>
            <p className="text-[#78716C] text-xs uppercase tracking-widest">Participants</p>
          </div>
          <p className="text-2xl font-bold text-[#E8E4D9]">{participants.length}</p>
        </div>
        <div className="p-5 rounded-xl bg-[#0A0A08] border border-[#1A1814]">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-[#D97706]/10">
              <Award className="w-4 h-4 text-[#D97706]" />
            </div>
            <p className="text-[#78716C] text-xs uppercase tracking-widest">Problems</p>
          </div>
          <p className="text-2xl font-bold text-[#E8E4D9]">{contest.problems?.length || 0}</p>
        </div>
        <div className="p-5 rounded-xl bg-[#0A0A08] border border-[#1A1814]">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-[#D97706]/10">
              <Clock className="w-4 h-4 text-[#D97706]" />
            </div>
            <p className="text-[#78716C] text-xs uppercase tracking-widest">Duration</p>
          </div>
          <p className="text-2xl font-bold text-[#E8E4D9]">{formatDuration(contest.duration)}</p>
        </div>
        <div className="p-5 rounded-xl bg-[#0A0A08] border border-[#1A1814]">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-[#D97706]/10">
              <Calendar className="w-4 h-4 text-[#D97706]" />
            </div>
            <p className="text-[#78716C] text-xs uppercase tracking-widest">Start Time</p>
          </div>
          <p className="text-lg font-semibold text-[#E8E4D9]">{formatDateTime(contest.startTime)}</p>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="border-b border-[#1A1814]"
      >
        <div className="flex gap-4">
          {['overview', 'participants', 'leaderboard', 'announcements'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 font-semibold text-sm uppercase tracking-wider border-b-2 -mb-px transition-colors ${
                activeTab === tab
                  ? 'border-[#D97706] text-[#D97706]'
                  : 'border-transparent text-[#78716C] hover:text-[#E8E4D9]'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Contest Settings */}
          <div className="rounded-xl border border-[#1A1814] bg-[#0A0A08] p-6">
            <h3 className="text-lg font-semibold text-[#E8E4D9] uppercase tracking-wider mb-4">Contest Settings</h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-[#78716C]">Ranking Type</dt>
                <dd className="text-[#E8E4D9]">{contest.rankingType?.toUpperCase()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#78716C]">Wrong Submission Penalty</dt>
                <dd className="text-[#E8E4D9]">{contest.penaltyRules?.wrongSubmissionPenalty} min</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#78716C]">Public</dt>
                <dd className="text-[#E8E4D9]">{contest.isPublic ? 'Yes' : 'No'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#78716C]">Registration Required</dt>
                <dd className="text-[#E8E4D9]">{contest.requiresRegistration ? 'Yes' : 'No'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#78716C]">Late Join Allowed</dt>
                <dd className="text-[#E8E4D9]">{contest.allowLateJoin ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
          </div>

          {/* Problems */}
          <div className="rounded-xl border border-[#1A1814] bg-[#0A0A08] p-6">
            <h3 className="text-lg font-semibold text-[#E8E4D9] uppercase tracking-wider mb-4">Problems</h3>
            <div className="space-y-2">
              {contest.problems?.map((p) => (
                <div key={p._id} className="flex items-center justify-between p-3 bg-[#0F0F0D] border border-[#1A1814] rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 flex items-center justify-center bg-[#D97706] rounded-lg text-white font-bold text-sm">
                      {p.label}
                    </span>
                    <span className="text-[#E8E4D9]">{p.problem?.title || 'Unknown'}</span>
                  </div>
                  <span className="text-[#D97706] font-semibold">{p.points} pts</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'participants' && (
        <div className="rounded-xl border border-[#1A1814] bg-[#0A0A08] overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#0F0F0D] border-b border-[#1A1814]">
              <tr>
                <th className="px-4 py-3 text-left text-[#78716C] font-semibold text-xs uppercase tracking-widest">#</th>
                <th className="px-4 py-3 text-left text-[#78716C] font-semibold text-xs uppercase tracking-widest">User</th>
                <th className="px-4 py-3 text-left text-[#78716C] font-semibold text-xs uppercase tracking-widest">Registered</th>
                <th className="px-4 py-3 text-left text-[#78716C] font-semibold text-xs uppercase tracking-widest">Joined</th>
                <th className="px-4 py-3 text-left text-[#78716C] font-semibold text-xs uppercase tracking-widest">Score</th>
                <th className="px-4 py-3 text-left text-[#78716C] font-semibold text-xs uppercase tracking-widest">Rank</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1814]">
              {participants.map((p, idx) => (
                <tr key={p._id} className="hover:bg-[#0F0F0D] transition-colors">
                  <td className="px-4 py-3 text-[#78716C]">{idx + 1}</td>
                  <td className="px-4 py-3 text-[#E8E4D9]">{p.user?.username || 'Unknown'}</td>
                  <td className="px-4 py-3 text-[#78716C]">{formatDateTime(p.registeredAt)}</td>
                  <td className="px-4 py-3 text-[#78716C]">
                    {p.joinedAt ? formatDateTime(p.joinedAt) : '-'}
                  </td>
                  <td className="px-4 py-3 text-[#E8E4D9]">{p.totalScore}</td>
                  <td className="px-4 py-3 text-[#E8E4D9]">{p.finalRank || '-'}</td>
                </tr>
              ))}
              {participants.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[#78716C]">
                    No participants yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'leaderboard' && (
        <div className="rounded-xl border border-[#1A1814] bg-[#0A0A08] overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#0F0F0D] border-b border-[#1A1814]">
              <tr>
                <th className="px-4 py-3 text-left text-[#78716C] font-semibold text-xs uppercase tracking-widest">Rank</th>
                <th className="px-4 py-3 text-left text-[#78716C] font-semibold text-xs uppercase tracking-widest">User</th>
                <th className="px-4 py-3 text-left text-[#78716C] font-semibold text-xs uppercase tracking-widest">Score</th>
                <th className="px-4 py-3 text-left text-[#78716C] font-semibold text-xs uppercase tracking-widest">Penalty</th>
                <th className="px-4 py-3 text-left text-[#78716C] font-semibold text-xs uppercase tracking-widest">Problems</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1814]">
              {leaderboard
                .sort((a, b) => b.totalScore - a.totalScore || a.totalPenalty - b.totalPenalty)
                .map((p, idx) => (
                  <tr key={p._id} className="hover:bg-[#0F0F0D] transition-colors">
                    <td className="px-4 py-3 text-[#E8E4D9] font-medium">
                      {idx + 1}
                      {idx === 0 && <span className="ml-1">🥇</span>}
                      {idx === 1 && <span className="ml-1">🥈</span>}
                      {idx === 2 && <span className="ml-1">🥉</span>}
                    </td>
                    <td className="px-4 py-3 text-[#E8E4D9]">{p.user?.username || 'Unknown'}</td>
                    <td className="px-4 py-3 text-emerald-400 font-semibold">{p.totalScore}</td>
                    <td className="px-4 py-3 text-[#92400E]">{p.totalPenalty} min</td>
                    <td className="px-4 py-3 text-[#78716C]">
                      {p.problemsAttempted?.size || 0} solved
                    </td>
                  </tr>
                ))}
              {leaderboard.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#78716C]">
                    No scores yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'announcements' && (
        <div className="rounded-xl border border-[#1A1814] bg-[#0A0A08] p-6">
          <h3 className="text-lg font-semibold text-[#E8E4D9] uppercase tracking-wider mb-2">Send Announcement</h3>
          <p className="text-[#78716C] text-sm mb-4">
            Send a real-time announcement to all participants in this contest.
          </p>
          <textarea
            value={announcement}
            onChange={(e) => setAnnouncement(e.target.value)}
            placeholder="Type your announcement message..."
            rows={4}
            className="w-full px-4 py-3 rounded-xl border border-[#1A1814] bg-[#0F0F0D] text-[#E8E4D9] placeholder-[#78716C] focus:outline-none focus:border-[#D97706]/50 focus:ring-2 focus:ring-[#D97706]/20 resize-none mb-4 transition-all"
          />
          <button
            onClick={handleSendAnnouncement}
            disabled={sendingAnnouncement || !announcement.trim()}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-[#D97706] to-[#F59E0B] hover:from-[#B45309] hover:to-[#D97706] text-white font-semibold uppercase tracking-wider text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Send className="w-4 h-4" />
            {sendingAnnouncement ? 'Sending...' : 'Send Announcement'}
          </button>
        </div>
      )}
    </div>
  );
}
