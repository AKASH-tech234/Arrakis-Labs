import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, Plus, Search, Edit, Trash2, Rocket, Play, Ban, Square, Loader2 } from 'lucide-react';
import adminContestApi from '../../services/admin/adminContestApi';

const STATUS_BADGES = {
  draft: { color: 'bg-[#78716C]/20 text-[#78716C] border border-[#78716C]/30', label: 'Draft' },
  scheduled: { color: 'bg-blue-500/20 text-blue-400 border border-blue-500/30', label: 'Scheduled' },
  live: { color: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30', label: 'Live' },
  ended: { color: 'bg-[#D97706]/20 text-[#D97706] border border-[#D97706]/30', label: 'Ended' },
  cancelled: { color: 'bg-red-500/20 text-red-400 border border-red-500/30', label: 'Cancelled' },
};

function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Confirm', danger = false }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#0F0F0D] rounded-xl border border-[#1A1814] p-6 max-w-md w-full mx-4 shadow-2xl"
      >
        <h3 className="text-lg font-semibold text-[#E8E4D9] mb-2" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>{title}</h3>
        <p className="text-[#78716C] mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-[#1A1814] hover:bg-[#1A1814]/80 text-[#E8E4D9] rounded-lg transition-colors border border-[#1A1814]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg transition-colors font-medium ${
              danger
                ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30'
                : 'bg-[#D97706] hover:bg-[#D97706]/80 text-white'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function AdminContestList() {
  const navigate = useNavigate();
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [modal, setModal] = useState({ isOpen: false, action: null, contest: null });

  const fetchContests = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter !== 'all') params.status = filter;
      if (search) params.search = search;

      const response = await adminContestApi.getContests(params);
      setContests(response.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load contests');
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    fetchContests();
  }, [fetchContests]);

  const handleAction = async (action, contest) => {
    try {
      switch (action) {
        case 'delete':
          await adminContestApi.deleteContest(contest._id);
          break;
        case 'publish':
          await adminContestApi.publishContest(contest._id);
          break;
        case 'cancel':
          await adminContestApi.cancelContest(contest._id, 'Cancelled by admin');
          break;
        case 'start':
          await adminContestApi.startContest(contest._id);
          break;
        case 'end':
          await adminContestApi.endContest(contest._id);
          break;
        default:
          return;
      }
      fetchContests();
      setModal({ isOpen: false, action: null, contest: null });
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${action} contest`);
    }
  };

  const openModal = (action, contest) => {
    setModal({ isOpen: true, action, contest });
  };

  const getModalConfig = () => {
    const { action, contest } = modal;
    switch (action) {
      case 'delete':
        return {
          title: 'Delete Contest',
          message: `Are you sure you want to delete "${contest?.title}"? This action cannot be undone.`,
          confirmText: 'Delete',
          danger: true,
        };
      case 'publish':
        return {
          title: 'Publish Contest',
          message: `Publish "${contest?.title}"? It will be visible to users.`,
          confirmText: 'Publish',
          danger: false,
        };
      case 'cancel':
        return {
          title: 'Cancel Contest',
          message: `Cancel "${contest?.title}"? Registered users will be notified.`,
          confirmText: 'Cancel Contest',
          danger: true,
        };
      case 'start':
        return {
          title: 'Start Contest Now',
          message: `Start "${contest?.title}" immediately? This will override the scheduled start time.`,
          confirmText: 'Start Now',
          danger: false,
        };
      case 'end':
        return {
          title: 'End Contest Now',
          message: `End "${contest?.title}" immediately? No more submissions will be accepted.`,
          confirmText: 'End Now',
          danger: true,
        };
      default:
        return {};
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  return (
    <div className="p-6 min-h-screen" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
      {}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-gradient-to-b from-[#D97706] to-[#D97706]/20 rounded-full" />
          <div>
            <h1 className="text-2xl font-bold text-[#E8E4D9] uppercase tracking-wider flex items-center gap-2">
              <Trophy className="h-6 w-6 text-[#D97706]" />
              Contests
            </h1>
            <p className="text-sm text-[#78716C]">Manage competitive programming contests</p>
          </div>
        </div>
        <Link
          to="/admin/contests/new"
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#D97706] to-amber-600 hover:from-[#D97706]/90 hover:to-amber-600/90 text-white rounded-lg transition-all font-medium shadow-lg shadow-[#D97706]/20"
        >
          <Plus className="h-4 w-4" />
          Create Contest
        </Link>
      </div>

      {}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex gap-2">
          {['all', 'draft', 'scheduled', 'live', 'ended'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm capitalize transition-all font-medium ${
                filter === status
                  ? 'bg-[#D97706] text-white shadow-lg shadow-[#D97706]/20'
                  : 'bg-[#0F0F0D] text-[#78716C] hover:text-[#E8E4D9] border border-[#1A1814] hover:border-[#D97706]/40'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#78716C]" />
          <input
            type="text"
            placeholder="Search contests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0F0F0D] text-[#E8E4D9] pl-10 pr-4 py-2.5 rounded-lg border border-[#1A1814] focus:border-[#D97706]/50 focus:outline-none focus:ring-1 focus:ring-[#D97706]/30 transition-all placeholder-[#78716C]"
          />
        </div>
      </div>

      {}
      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-4 flex items-center justify-between"
        >
          <span>{error}</span>
          <button onClick={() => setError(null)} className="hover:text-red-300">×</button>
        </motion.div>
      )}

      {}
      {loading ? (
        <div className="text-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-[#D97706] mx-auto" />
          <p className="text-[#78716C] mt-4">Loading contests...</p>
        </div>
      ) : contests.length === 0 ? (
        <div className="text-center py-16 bg-[#0F0F0D] rounded-xl border border-[#1A1814]">
          <Trophy className="h-12 w-12 text-[#78716C] mx-auto mb-4" />
          <p className="text-[#78716C]">No contests found. Create your first contest!</p>
        </div>
      ) : (
        
        <div className="bg-[#0F0F0D] rounded-xl border border-[#1A1814] overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#0A0A08]">
              <tr>
                <th className="px-4 py-4 text-left text-xs font-semibold text-[#78716C] uppercase tracking-wider">Title</th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-[#78716C] uppercase tracking-wider">Status</th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-[#78716C] uppercase tracking-wider">Start Time</th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-[#78716C] uppercase tracking-wider">Duration</th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-[#78716C] uppercase tracking-wider">Problems</th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-[#78716C] uppercase tracking-wider">Registrations</th>
                <th className="px-4 py-4 text-right text-xs font-semibold text-[#78716C] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1814]">
              {contests.map((contest, index) => (
                <motion.tr 
                  key={contest._id} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="hover:bg-[#1A1814]/30 transition-colors"
                >
                  <td className="px-4 py-4">
                    <Link
                      to={`/admin/contests/${contest._id}`}
                      className="text-[#E8E4D9] hover:text-[#D97706] font-medium transition-colors"
                    >
                      {contest.title}
                    </Link>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${STATUS_BADGES[contest.status]?.color}`}>
                      {STATUS_BADGES[contest.status]?.label}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-[#78716C] text-sm">
                    {formatDate(contest.startTime)}
                  </td>
                  <td className="px-4 py-4 text-[#78716C] text-sm">
                    {contest.duration} min
                  </td>
                  <td className="px-4 py-4 text-[#78716C] text-sm">
                    {contest.problems?.length || 0}
                  </td>
                  <td className="px-4 py-4 text-[#78716C] text-sm">
                    {contest.registrationCount || 0}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => navigate(`/admin/contests/${contest._id}/edit`)}
                        className="p-2 text-[#78716C] hover:text-[#D97706] hover:bg-[#D97706]/10 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>

                      {contest.status === 'draft' && (
                        <button
                          onClick={() => openModal('publish', contest)}
                          className="p-2 text-[#78716C] hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                          title="Publish"
                        >
                          <Rocket className="h-4 w-4" />
                        </button>
                      )}

                      {contest.status === 'scheduled' && (
                        <>
                          <button
                            onClick={() => openModal('start', contest)}
                            className="p-2 text-[#78716C] hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                            title="Start Now"
                          >
                            <Play className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openModal('cancel', contest)}
                            className="p-2 text-[#78716C] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Cancel"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        </>
                      )}

                      {contest.status === 'live' && (
                        <button
                          onClick={() => openModal('end', contest)}
                          className="p-2 text-[#78716C] hover:text-[#D97706] hover:bg-[#D97706]/10 rounded-lg transition-colors"
                          title="End Now"
                        >
                          <Square className="h-4 w-4" />
                        </button>
                      )}

                      {['draft', 'cancelled'].includes(contest.status) && (
                        <button
                          onClick={() => openModal('delete', contest)}
                          className="p-2 text-[#78716C] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {}
      <ConfirmModal
        isOpen={modal.isOpen}
        onConfirm={() => handleAction(modal.action, modal.contest)}
        onCancel={() => setModal({ isOpen: false, action: null, contest: null })}
        {...getModalConfig()}
      />
    </div>
  );
}
