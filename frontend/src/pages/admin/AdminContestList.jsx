import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, Plus, Search, Edit, Trash2, Rocket, Play, Ban, Square, Loader2, Calendar, Clock, Users, FileText } from 'lucide-react';
import adminContestApi from '../../services/admin/adminContestApi';

const STATUS_BADGES = {
  draft: { color: 'bg-[#78716C]/10 text-[#78716C] border border-[#78716C]/20', label: 'Draft', dot: 'bg-[#78716C]' },
  scheduled: { color: 'bg-blue-500/10 text-blue-400 border border-blue-500/20', label: 'Scheduled', dot: 'bg-blue-400' },
  live: { color: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20', label: 'Live', dot: 'bg-emerald-400 animate-pulse' },
  ended: { color: 'bg-[#D97706]/10 text-[#D97706] border border-[#D97706]/20', label: 'Ended', dot: 'bg-[#D97706]' },
  cancelled: { color: 'bg-red-500/10 text-red-400 border border-red-500/20', label: 'Cancelled', dot: 'bg-red-400' },
};

function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Confirm', danger = false }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-[#0F0F0D] rounded-xl border border-[#1A1814] p-6 max-w-md w-full mx-4 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2.5 rounded-lg ${danger ? 'bg-red-500/10' : 'bg-[#D97706]/10'}`}>
            {danger ? (
              <Trash2 className="h-5 w-5 text-red-400" />
            ) : (
              <Trophy className="h-5 w-5 text-[#D97706]" />
            )}
          </div>
          <h3 className="text-lg font-semibold text-[#E8E4D9]" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>{title}</h3>
        </div>
        <p className="text-[#78716C] mb-6 text-sm" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 bg-[#1A1814] hover:bg-[#1A1814]/80 text-[#E8E4D9] rounded-lg transition-all border border-[#1A1814] hover:border-[#78716C]/30 text-sm font-medium"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2.5 rounded-lg transition-all font-medium text-sm ${
              danger
                ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 hover:border-red-500/50'
                : 'bg-gradient-to-r from-[#D97706] to-amber-600 hover:from-[#D97706]/90 hover:to-amber-600/90 text-white shadow-lg shadow-[#D97706]/20'
            }`}
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
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
    <div className="space-y-8" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between"
      >
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-6 bg-gradient-to-b from-[#D97706] to-transparent rounded-full" />
            <h1 className="text-2xl font-bold text-[#E8E4D9] tracking-wide">
              Contests
            </h1>
          </div>
          <p className="text-[#78716C] text-sm uppercase tracking-widest ml-3">
            Manage competitive programming contests
          </p>
        </div>
        <Link
          to="/admin/contests/new"
          className="group relative overflow-hidden flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#D97706] to-amber-600 hover:from-[#D97706]/90 hover:to-amber-600/90 text-white rounded-lg transition-all font-medium shadow-lg shadow-[#D97706]/20"
        >
          <Plus className="h-4 w-4" />
          <span className="uppercase tracking-wider text-sm">Create Contest</span>
        </Link>
      </motion.div>

      {/* Filters & Search */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-col sm:flex-row items-start sm:items-center gap-4"
      >
        <div className="flex flex-wrap gap-2">
          {['all', 'draft', 'scheduled', 'live', 'ended'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-xs uppercase tracking-wider transition-all font-medium ${
                filter === status
                  ? 'bg-[#D97706]/20 text-[#F59E0B] border border-[#D97706]/40 shadow-lg shadow-[#D97706]/10'
                  : 'bg-[#0F0F0D] text-[#78716C] hover:text-[#E8E4D9] border border-[#1A1814] hover:border-[#D97706]/30 hover:bg-[#1A1814]/50'
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
            className="w-full bg-[#0F0F0D] text-[#E8E4D9] pl-10 pr-4 py-2.5 rounded-lg border border-[#1A1814] focus:border-[#D97706]/50 focus:outline-none focus:ring-2 focus:ring-[#D97706]/20 transition-all placeholder-[#78716C] text-sm"
          />
        </div>
      </motion.div>

      {/* Error Alert */}
      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <Ban className="h-4 w-4" />
            </div>
            <span className="text-sm">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="hover:text-red-300 p-1 hover:bg-red-500/10 rounded transition-colors">×</button>
        </motion.div>
      )}

      {/* Contest List */}
      {loading ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20"
        >
          <div className="p-4 rounded-xl bg-[#0F0F0D] border border-[#1A1814]">
            <Loader2 className="h-8 w-8 animate-spin text-[#D97706]" />
          </div>
          <p className="text-[#78716C] mt-4 text-sm uppercase tracking-wider">Loading contests...</p>
        </motion.div>
      ) : contests.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16 rounded-xl border border-[#1A1814] bg-[#0F0F0D]"
        >
          <div className="p-4 rounded-xl bg-[#1A1814] inline-block mb-4">
            <Trophy className="h-10 w-10 text-[#78716C]" />
          </div>
          <p className="text-[#78716C] mb-4">No contests found</p>
          <Link
            to="/admin/contests/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#D97706]/10 text-[#D97706] hover:bg-[#D97706]/20 rounded-lg transition-colors border border-[#D97706]/30 text-sm font-medium uppercase tracking-wider"
          >
            <Plus className="h-4 w-4" />
            Create your first contest
          </Link>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="space-y-3"
        >
          {contests.map((contest, index) => (
            <motion.div
              key={contest._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="group rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-5 hover:border-[#D97706]/30 transition-all duration-300 hover:shadow-lg hover:shadow-[#D97706]/5"
            >
              <div className="flex items-center justify-between">
                {/* Left: Contest Info */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="p-3 rounded-lg bg-[#1A1814] group-hover:bg-[#D97706]/10 transition-colors">
                    <Trophy className="h-5 w-5 text-[#78716C] group-hover:text-[#D97706] transition-colors" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <Link
                        to={`/admin/contests/${contest._id}`}
                        className="text-[#E8E4D9] hover:text-[#F59E0B] font-semibold transition-colors truncate text-lg"
                      >
                        {contest.title}
                      </Link>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium uppercase tracking-wider ${STATUS_BADGES[contest.status]?.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_BADGES[contest.status]?.dot}`} />
                        {STATUS_BADGES[contest.status]?.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[#78716C]">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(contest.startTime)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {contest.duration} min
                      </span>
                      <span className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        {contest.problems?.length || 0} problems
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        {contest.registrationCount || 0} registered
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1 ml-4">
                  <button
                    onClick={() => navigate(`/admin/contests/${contest._id}/edit`)}
                    className="p-2.5 text-[#78716C] hover:text-[#D97706] hover:bg-[#D97706]/10 rounded-lg transition-all border border-transparent hover:border-[#D97706]/20"
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </button>

                  {contest.status === 'draft' && (
                    <button
                      onClick={() => openModal('publish', contest)}
                      className="p-2.5 text-[#78716C] hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all border border-transparent hover:border-emerald-500/20"
                      title="Publish"
                    >
                      <Rocket className="h-4 w-4" />
                    </button>
                  )}

                  {contest.status === 'scheduled' && (
                    <>
                      <button
                        onClick={() => openModal('start', contest)}
                        className="p-2.5 text-[#78716C] hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all border border-transparent hover:border-emerald-500/20"
                        title="Start Now"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openModal('cancel', contest)}
                        className="p-2.5 text-[#78716C] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all border border-transparent hover:border-red-500/20"
                        title="Cancel"
                      >
                        <Ban className="h-4 w-4" />
                      </button>
                    </>
                  )}

                  {contest.status === 'live' && (
                    <button
                      onClick={() => openModal('end', contest)}
                      className="p-2.5 text-[#78716C] hover:text-[#D97706] hover:bg-[#D97706]/10 rounded-lg transition-all border border-transparent hover:border-[#D97706]/20"
                      title="End Now"
                    >
                      <Square className="h-4 w-4" />
                    </button>
                  )}

                  {['draft', 'cancelled'].includes(contest.status) && (
                    <button
                      onClick={() => openModal('delete', contest)}
                      className="p-2.5 text-[#78716C] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all border border-transparent hover:border-red-500/20"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
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
