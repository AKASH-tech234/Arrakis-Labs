import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import adminApi from '../../../services/admin/adminApi';

export default function ContestEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [availableProblems, setAvailableProblems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startTime: '',
    duration: 90,
    problems: [],
    scoringRules: {
      defaultPoints: 100,
      partialScoring: false,
    },
    penaltyRules: {
      wrongSubmissionPenalty: 5,
      penaltyOnlyAfterAC: true,
    },
    rankingType: 'lcb',
    isPublic: true,
    requiresRegistration: true,
    maxParticipants: 0,
    allowLateJoin: true,
    lateJoinDeadline: 30,
    showLeaderboardDuringContest: true,
    freezeLeaderboardMinutes: 0,
  });

  useEffect(() => {
    if (isEditing) {
      fetchContest();
    }
    fetchProblems();
  }, [id]);

  const fetchContest = async () => {
    try {
      setLoading(true);
      const response = await adminApi.get(`/contests/${id}`);
      const contest = response.data.data;

      const startDate = new Date(contest.startTime);
      const localDateTime = new Date(startDate.getTime() - startDate.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);

      setFormData({
        ...formData,
        ...contest,
        startTime: localDateTime,
        problems: contest.problems?.map(p => ({
          problemId: p.problem._id || p.problem,
          label: p.label,
          points: p.points,
          order: p.order,
          title: p.problem.title || '',
        })) || [],
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch contest');
    } finally {
      setLoading(false);
    }
  };

  const fetchProblems = async () => {
    try {
      const response = await adminApi.get('/questions', { params: { page: 1, limit: 500 } });
      setAvailableProblems(response.data.data);
    } catch (err) {
      console.error('Failed to fetch problems:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value,
        },
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value,
      }));
    }
  };

  const addProblem = (problem) => {
    if (formData.problems.find(p => p.problemId === problem._id)) {
      return; 
    }
    
    const order = formData.problems.length;
    const label = String.fromCharCode(65 + order); 
    
    setFormData(prev => ({
      ...prev,
      problems: [
        ...prev.problems,
        {
          problemId: problem._id,
          title: problem.title,
          label,
          points: formData.scoringRules.defaultPoints,
          order,
        },
      ],
    }));
  };

  const removeProblem = (problemId) => {
    setFormData(prev => {
      const newProblems = prev.problems
        .filter(p => p.problemId !== problemId)
        .map((p, idx) => ({
          ...p,
          order: idx,
          label: String.fromCharCode(65 + idx),
        }));
      return { ...prev, problems: newProblems };
    });
  };

  const updateProblemPoints = (problemId, points) => {
    setFormData(prev => ({
      ...prev,
      problems: prev.problems.map(p =>
        p.problemId === problemId ? { ...p, points: Number(points) } : p
      ),
    }));
  };

  const moveProblem = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= formData.problems.length) return;

    setFormData(prev => {
      const problems = [...prev.problems];
      [problems[index], problems[newIndex]] = [problems[newIndex], problems[index]];
      return {
        ...prev,
        problems: problems.map((p, idx) => ({
          ...p,
          order: idx,
          label: String.fromCharCode(65 + idx),
        })),
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.startTime || !formData.duration) {
      setError('Name, start time, and duration are required');
      return;
    }

    if (formData.problems.length === 0) {
      setError('Add at least one problem to the contest');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        ...formData,
        startTime: new Date(formData.startTime).toISOString(),
        problems: formData.problems.map(p => ({
          problemId: p.problemId,
          label: p.label,
          points: p.points,
          order: p.order,
        })),
      };

      if (isEditing) {
        await adminApi.put(`/contests/${id}`, payload);
      } else {
        await adminApi.post('/contests', payload);
      }

      navigate('/admin/contests');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save contest');
    } finally {
      setSaving(false);
    }
  };

  const filteredProblems = availableProblems.filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !formData.problems.find(fp => fp.problemId === p._id)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl">
      {}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/admin/contests"
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isEditing ? 'Edit Contest' : 'Create Contest'}
          </h1>
          <p className="text-gray-400 mt-1">
            {isEditing ? 'Update contest settings' : 'Set up a new coding contest'}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {}
        <section className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Basic Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Contest Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Weekly Contest 123"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Contest description..."
              />
            </div>

            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Start Time (Local) *
              </label>
              <input
                type="datetime-local"
                name="startTime"
                value={formData.startTime}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Duration (minutes) *
              </label>
              <input
                type="number"
                name="duration"
                value={formData.duration}
                onChange={handleChange}
                min={5}
                max={720}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>
        </section>

        {}
        <section className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Problems</h2>
          
          {}
          {formData.problems.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Selected Problems ({formData.problems.length})</h3>
              <div className="space-y-2">
                {formData.problems.map((problem, index) => (
                  <div
                    key={problem.problemId}
                    className="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 flex items-center justify-center bg-blue-600 rounded text-white font-bold">
                        {problem.label}
                      </span>
                      <span className="text-white">{problem.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={problem.points}
                        onChange={(e) => updateProblemPoints(problem.problemId, e.target.value)}
                        className="w-20 px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm"
                        min={1}
                      />
                      <span className="text-gray-400 text-sm">pts</span>
                      <button
                        type="button"
                        onClick={() => moveProblem(index, -1)}
                        disabled={index === 0}
                        className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveProblem(index, 1)}
                        disabled={index === formData.problems.length - 1}
                        className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeProblem(problem.problemId)}
                        className="p-1 text-red-400 hover:text-red-300"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Add Problems</h3>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search problems..."
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white mb-3"
            />
            <div className="max-h-60 overflow-y-auto space-y-1">
              {filteredProblems.slice(0, 20).map((problem) => (
                <button
                  key={problem._id}
                  type="button"
                  onClick={() => addProblem(problem)}
                  className="w-full flex items-center justify-between p-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-left"
                >
                  <div>
                    <span className="text-white">{problem.title}</span>
                    <span className={`ml-2 text-sm ${
                      problem.difficulty === 'Easy' ? 'text-green-400' :
                      problem.difficulty === 'Medium' ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {problem.difficulty}
                    </span>
                  </div>
                  <span className="text-blue-400 text-sm">+ Add</span>
                </button>
              ))}
              {filteredProblems.length === 0 && (
                <p className="text-gray-500 text-center py-4">No problems found</p>
              )}
            </div>
          </div>
        </section>

        {}
        <section className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Scoring & Rules</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Default Points per Problem
              </label>
              <input
                type="number"
                name="scoringRules.defaultPoints"
                value={formData.scoringRules.defaultPoints}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
              />
            </div>

            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Wrong Submission Penalty (minutes)
              </label>
              <input
                type="number"
                name="penaltyRules.wrongSubmissionPenalty"
                value={formData.penaltyRules.wrongSubmissionPenalty}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
              />
            </div>

            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Ranking Type
              </label>
              <select
                name="rankingType"
                value={formData.rankingType}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
              >
                <option value="lcb">LeetCode Style</option>
                <option value="icpc">ICPC Style</option>
                <option value="ioi">IOI Style</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Late Join Deadline (minutes after start)
              </label>
              <input
                type="number"
                name="lateJoinDeadline"
                value={formData.lateJoinDeadline}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="isPublic"
                checked={formData.isPublic}
                onChange={handleChange}
                className="w-4 h-4 rounded border-gray-500 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-300 text-sm">Public Contest</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="requiresRegistration"
                checked={formData.requiresRegistration}
                onChange={handleChange}
                className="w-4 h-4 rounded border-gray-500 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-300 text-sm">Require Registration</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="allowLateJoin"
                checked={formData.allowLateJoin}
                onChange={handleChange}
                className="w-4 h-4 rounded border-gray-500 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-300 text-sm">Allow Late Join</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="showLeaderboardDuringContest"
                checked={formData.showLeaderboardDuringContest}
                onChange={handleChange}
                className="w-4 h-4 rounded border-gray-500 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-300 text-sm">Show Leaderboard</span>
            </label>
          </div>
        </section>

        {}
        <div className="flex items-center justify-end gap-4">
          <Link
            to="/admin/contests"
            className="px-6 py-3 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 font-medium"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {saving && (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {isEditing ? 'Save Changes' : 'Create Contest'}
          </button>
        </div>
      </form>
    </div>
  );
}
