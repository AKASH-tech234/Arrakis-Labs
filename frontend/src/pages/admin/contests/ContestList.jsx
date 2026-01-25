import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import adminApi from '../../../services/admin/adminApi';

/**
 * Admin Contest List Page
 * Shows all contests with management options
 */

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
      draft: 'bg-gray-500/20 text-gray-400',
      scheduled: 'bg-blue-500/20 text-blue-400',
      live: 'bg-green-500/20 text-green-400 animate-pulse',
      ended: 'bg-purple-500/20 text-purple-400',
      cancelled: 'bg-red-500/20 text-red-400',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || styles.draft}`}>
        {status?.toUpperCase()}
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Contests</h1>
          <p className="text-gray-400 mt-1">Manage coding contests</p>
        </div>
        <Link
          to="/admin/contests/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Contest
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6">
        {['all', 'draft', 'scheduled', 'live', 'ended', 'cancelled'].map((status) => (
          <button
            key={status}
            onClick={() => { setFilter(status); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Contest Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700/50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Contest
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Start Time
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Duration
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Problems
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Registered
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {contests.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                  No contests found
                </td>
              </tr>
            ) : (
              contests.map((contest) => (
                <tr key={contest._id} className="hover:bg-gray-700/50">
                  <td className="px-6 py-4">
                    <div>
                      <Link
                        to={`/admin/contests/${contest._id}`}
                        className="text-white font-medium hover:text-blue-400"
                      >
                        {contest.name}
                      </Link>
                      <p className="text-gray-500 text-sm truncate max-w-xs">
                        {contest.slug}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(contest.status)}
                  </td>
                  <td className="px-6 py-4 text-gray-300">
                    {formatDate(contest.startTime)}
                  </td>
                  <td className="px-6 py-4 text-gray-300">
                    {contest.duration} min
                  </td>
                  <td className="px-6 py-4 text-gray-300">
                    {contest.problems?.length || 0}
                  </td>
                  <td className="px-6 py-4 text-gray-300">
                    {contest.stats?.registeredCount || 0}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {contest.status === 'draft' && (
                        <>
                          <button
                            onClick={() => handlePublish(contest._id)}
                            className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg"
                            title="Publish"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <Link
                            to={`/admin/contests/${contest._id}/edit`}
                            className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg"
                            title="Edit"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </Link>
                          <button
                            onClick={() => handleDelete(contest._id)}
                            className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                            title="Delete"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </>
                      )}
                      {(contest.status === 'scheduled' || contest.status === 'live') && (
                        <button
                          onClick={() => handleCancel(contest._id)}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                          title="Cancel"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                      <Link
                        to={`/admin/contests/${contest._id}`}
                        className="p-2 text-gray-400 hover:bg-gray-600 rounded-lg"
                        title="View"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-gray-400 text-sm">
            Showing {(page - 1) * pagination.limit + 1} to{' '}
            {Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600"
            >
              Previous
            </button>
            <span className="text-gray-400">
              Page {page} of {pagination.pages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
              disabled={page === pagination.pages}
              className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
