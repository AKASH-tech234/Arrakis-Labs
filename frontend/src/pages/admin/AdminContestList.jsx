import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import adminContestApi from '../../services/admin/adminContestApi';

const STATUS_BADGES = {
  draft: { color: 'bg-gray-500/20 text-gray-400', label: 'Draft' },
  scheduled: { color: 'bg-blue-500/20 text-blue-400', label: 'Scheduled' },
  live: { color: 'bg-green-500/20 text-green-400', label: 'Live' },
  ended: { color: 'bg-yellow-500/20 text-yellow-400', label: 'Ended' },
  cancelled: { color: 'bg-red-500/20 text-red-400', label: 'Cancelled' },
};

function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Confirm', danger = false }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-medium text-white mb-2">{title}</h3>
        <p className="text-gray-400 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded transition-colors ${
              danger
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
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
    <div className="p-6">
      {}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Contests</h1>
        <Link
          to="/admin/contests/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
        >
          + Create Contest
        </Link>
      </div>

      {}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex gap-2">
          {['all', 'draft', 'scheduled', 'live', 'ended'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1.5 rounded text-sm capitalize ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search contests..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-xs bg-gray-700 text-white px-3 py-2 rounded"
        />
      </div>

      {}
      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-3 rounded mb-4">
          {error}
          <button onClick={() => setError(null)} className="float-right">×</button>
        </div>
      )}

      {}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        </div>
      ) : contests.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No contests found. Create your first contest!
        </div>
      ) : (
        
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Title</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Start Time</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Duration</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Problems</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Registrations</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {contests.map((contest) => (
                <tr key={contest._id} className="hover:bg-gray-700/50">
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/contests/${contest._id}`}
                      className="text-white hover:text-blue-400"
                    >
                      {contest.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${STATUS_BADGES[contest.status]?.color}`}>
                      {STATUS_BADGES[contest.status]?.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">
                    {formatDate(contest.startTime)}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">
                    {contest.duration} min
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">
                    {contest.problems?.length || 0}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">
                    {contest.registrationCount || 0}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => navigate(`/admin/contests/${contest._id}/edit`)}
                        className="p-1.5 text-gray-400 hover:text-white"
                        title="Edit"
                      >
                        ✏️
                      </button>

                      {contest.status === 'draft' && (
                        <button
                          onClick={() => openModal('publish', contest)}
                          className="p-1.5 text-gray-400 hover:text-green-400"
                          title="Publish"
                        >
                          🚀
                        </button>
                      )}

                      {contest.status === 'scheduled' && (
                        <>
                          <button
                            onClick={() => openModal('start', contest)}
                            className="p-1.5 text-gray-400 hover:text-green-400"
                            title="Start Now"
                          >
                            ▶️
                          </button>
                          <button
                            onClick={() => openModal('cancel', contest)}
                            className="p-1.5 text-gray-400 hover:text-red-400"
                            title="Cancel"
                          >
                            🚫
                          </button>
                        </>
                      )}

                      {contest.status === 'live' && (
                        <button
                          onClick={() => openModal('end', contest)}
                          className="p-1.5 text-gray-400 hover:text-yellow-400"
                          title="End Now"
                        >
                          ⏹️
                        </button>
                      )}

                      {['draft', 'cancelled'].includes(contest.status) && (
                        <button
                          onClick={() => openModal('delete', contest)}
                          className="p-1.5 text-gray-400 hover:text-red-400"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
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
