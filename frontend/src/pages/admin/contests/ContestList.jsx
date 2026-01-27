import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import adminApi from '../../../services/admin/adminApi';
import {
  Plus,
  Trophy,
  Calendar,
  Clock,
  Users,
  Loader2,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export default function AdminContestList() {
  const { admin } = useAdminAuth();
  const navigate = useNavigate();
  
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    fetchContests();
  }, [filter, page]);

  const fetchContests = async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (filter !== 'all') params.status = filter;
      
      const response = await adminApi.get('/contests', { params });
      setContests(response.data.data);
      setPagination(response.data.pagination);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch contests');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-[#78716C]/10 text-[#78716C] border border-[#78716C]/20',
      scheduled: 'bg-[#D97706]/10 text-[#D97706] border border-[#D97706]/20',
      live: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      ended: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
      cancelled: 'bg-red-500/10 text-red-400 border border-red-500/20',
    };
    return (
      <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg uppercase tracking-wider ${styles[status] || styles.draft}`}>
        {status === 'live' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />}
        {status}
      </span>
    );
  };

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const handlePublish = async (contestId) => {
    if (!confirm('Publish this contest? It will be visible to users.')) return;
    try {
      await adminApi.post(`/contests/${contestId}/publish`);
      fetchContests();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to publish contest');
    }
  };

  const handleCancel = async (contestId) => {
    const reason = prompt('Reason for cancellation:');
    if (!reason) return;
    try {
      await adminApi.post(`/contests/${contestId}/cancel`, { reason });
      fetchContests();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel contest');
    }
  };

  const handleDelete = async (contestId) => {
    if (!confirm('Delete this contest? This action cannot be undone.')) return;
    try {
      await adminApi.delete(`/contests/${contestId}`);
      fetchContests();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete contest');
    }
  };

  if (loading && contests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="p-4 rounded-xl bg-[#0F0F0D] border border-[#1A1814]">
          <Loader2 className="h-8 w-8 animate-spin text-[#D97706]" />
        </div>
        <p className="text-[#78716C] mt-4 text-sm uppercase tracking-wider" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
          Loading contests...
        </p>
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
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-gradient-to-b from-[#D97706] to-transparent rounded-full" />
          <div>
            <h1 className="text-2xl font-bold text-[#E8E4D9] tracking-wide">Contests</h1>
            <p className="text-[#78716C] text-sm uppercase tracking-widest">Manage coding contests</p>
          </div>
        </div>
        <Link
          to="/admin/contests/new"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D97706] to-[#F59E0B] hover:from-[#B45309] hover:to-[#D97706] text-white font-semibold transition-all shadow-lg shadow-[#D97706]/20 uppercase tracking-wider text-sm"
        >
          <Plus className="h-5 w-5" />
          Create Contest
        </Link>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex items-center gap-2"
      >
        {['all', 'draft', 'scheduled', 'live', 'ended', 'cancelled'].map((status) => (
          <button
            key={status}
            onClick={() => { setFilter(status); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold uppercase tracking-wider transition-all ${
              filter === status
                ? 'bg-[#D97706] text-white'
                : 'bg-[#0F0F0D] text-[#78716C] border border-[#1A1814] hover:border-[#D97706]/40 hover:text-[#E8E4D9]'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm"
        >
          {error}
        </motion.div>
      )}

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="rounded-xl border border-[#1A1814] bg-[#0A0A08] overflow-hidden"
      >
        <table className="w-full">
          <thead className="bg-[#0F0F0D]">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[#78716C] uppercase tracking-widest">
                Contest
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[#78716C] uppercase tracking-widest">
                Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[#78716C] uppercase tracking-widest">
                Start Time
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[#78716C] uppercase tracking-widest">
                Duration
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[#78716C] uppercase tracking-widest">
                Problems
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[#78716C] uppercase tracking-widest">
                Registered
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-[#78716C] uppercase tracking-widest">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1A1814]">
            {contests.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-[#78716C]">
                  No contests found
                </td>
              </tr>
            ) : (
              contests.map((contest) => (
                <tr key={contest._id} className="hover:bg-[#0F0F0D] transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <Link
                        to={`/admin/contests/${contest._id}`}
                        className="text-[#E8E4D9] font-medium hover:text-[#D97706] transition-colors"
                      >
                        {contest.name}
                      </Link>
                      <p className="text-[#78716C] text-sm truncate max-w-xs">
                        {contest.slug}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(contest.status)}
                  </td>
                  <td className="px-6 py-4 text-[#E8E4D9]">
                    {formatDate(contest.startTime)}
                  </td>
                  <td className="px-6 py-4 text-[#E8E4D9]">
                    {contest.duration} min
                  </td>
                  <td className="px-6 py-4 text-[#E8E4D9]">
                    {contest.problems?.length || 0}
                  </td>
                  <td className="px-6 py-4 text-[#E8E4D9]">
                    {contest.stats?.registeredCount || 0}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {contest.status === 'draft' && (
                        <>
                          <button
                            onClick={() => handlePublish(contest._id)}
                            className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                            title="Publish"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                          <Link
                            to={`/admin/contests/${contest._id}/edit`}
                            className="p-2 text-[#D97706] hover:bg-[#D97706]/10 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-5 h-5" />
                          </Link>
                          <button
                            onClick={() => handleDelete(contest._id)}
                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </>
                      )}
                      {(contest.status === 'scheduled' || contest.status === 'live') && (
                        <button
                          onClick={() => handleCancel(contest._id)}
                          className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Cancel"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      )}
                      <Link
                        to={`/admin/contests/${contest._id}`}
                        className="p-2 text-[#78716C] hover:bg-[#1A1814] hover:text-[#E8E4D9] rounded-lg transition-colors"
                        title="View"
                      >
                        <Eye className="w-5 h-5" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </motion.div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[#78716C] text-sm">
            Showing {(page - 1) * pagination.limit + 1} to{' '}
            {Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0F0F0D] border border-[#1A1814] text-[#78716C] hover:border-[#D97706]/40 hover:text-[#E8E4D9] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <span className="text-[#78716C] px-3">
              Page {page} of {pagination.pages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
              disabled={page === pagination.pages}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0F0F0D] border border-[#1A1814] text-[#78716C] hover:border-[#D97706]/40 hover:text-[#E8E4D9] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
