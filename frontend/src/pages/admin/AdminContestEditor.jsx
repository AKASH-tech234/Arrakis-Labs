import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import adminContestApi from '../../services/admin/adminContestApi';

/**
 * Admin Contest Editor Page
 * - Create or edit a contest
 * - Problem selection
 * - Scoring and penalty configuration
 */

const EMPTY_CONTEST = {
  title: '',
  description: '',
  startTime: '',
  duration: 90,
  visibility: 'public',
  registrationRequired: true,
  registrationDeadline: '',
  allowLateJoin: true,
  lateJoinDeadline: '',
  scoringRules: {
    type: 'icpc',
    pointsPerProblem: 100,
    partialScoring: false,
  },
  penaltyRules: {
    wrongSubmissionPenalty: 20,
    timeBasedPenalty: true,
    penaltyUnit: 'minutes',
  },
  problems: [],
};

function ProblemSelector({ selected, onChange }) {
  const [search, setSearch] = useState('');
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchProblems = async (query) => {
    if (!query || query.length < 2) return;
    
    try {
      setLoading(true);
      // Using existing question API
      const response = await fetch(`/api/questions?search=${query}&limit=20`);
      const data = await response.json();
      setProblems(data.questions || []);
    } catch (err) {
      console.error('Failed to search problems:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => searchProblems(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const addProblem = (problem) => {
    if (selected.find((p) => p.questionId === problem._id)) return;
    
    const label = String.fromCharCode(65 + selected.length); // A, B, C...
    onChange([
      ...selected,
      {
        questionId: problem._id,
        label,
        title: problem.title,
        points: 100,
        difficulty: problem.difficulty,
      },
    ]);
    setSearch('');
    setProblems([]);
  };

  const removeProblem = (index) => {
    const updated = selected.filter((_, i) => i !== index);
    // Re-label
    onChange(updated.map((p, i) => ({ ...p, label: String.fromCharCode(65 + i) })));
  };

  const updatePoints = (index, points) => {
    const updated = [...selected];
    updated[index] = { ...updated[index], points: parseInt(points) || 0 };
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-300 mb-2">
        Problems
      </label>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search problems to add..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-gray-700 text-white px-3 py-2 rounded"
        />
        
        {/* Search Results */}
        {problems.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded shadow-lg max-h-60 overflow-y-auto">
            {problems.map((problem) => (
              <button
                key={problem._id}
                onClick={() => addProblem(problem)}
                className="w-full px-3 py-2 text-left hover:bg-gray-600 text-white"
                disabled={selected.find((p) => p.questionId === problem._id)}
              >
                <span className="font-medium">{problem.title}</span>
                <span className={`ml-2 text-sm ${
                  problem.difficulty === 'Easy' ? 'text-green-400' :
                  problem.difficulty === 'Medium' ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  ({problem.difficulty})
                </span>
              </button>
            ))}
          </div>
        )}
        {loading && (
          <div className="absolute right-3 top-2.5">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          </div>
        )}
      </div>

      {/* Selected Problems */}
      {selected.length > 0 ? (
        <div className="space-y-2">
          {selected.map((problem, index) => (
            <div
              key={problem.questionId}
              className="flex items-center gap-3 bg-gray-700 rounded p-3"
            >
              <span className="w-8 h-8 flex items-center justify-center bg-blue-600 rounded text-white font-mono">
                {problem.label}
              </span>
              <div className="flex-1">
                <p className="text-white">{problem.title}</p>
                <span className={`text-xs ${
                  problem.difficulty === 'Easy' ? 'text-green-400' :
                  problem.difficulty === 'Medium' ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {problem.difficulty}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-gray-400 text-sm">Points:</label>
                <input
                  type="number"
                  value={problem.points}
                  onChange={(e) => updatePoints(index, e.target.value)}
                  className="w-20 bg-gray-600 text-white px-2 py-1 rounded text-sm"
                />
              </div>
              <button
                onClick={() => removeProblem(index)}
                className="text-red-400 hover:text-red-300 p-1"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-center py-4">
          No problems added yet. Search and add problems above.
        </p>
      )}
    </div>
  );
}

export default function AdminContestEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [contest, setContest] = useState(EMPTY_CONTEST);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Format datetime for input
  const formatDateTimeLocal = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().slice(0, 16);
  };

  const fetchContest = useCallback(async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const response = await adminContestApi.getContest(id);
      const data = response.data;
      
      setContest({
        ...data,
        startTime: formatDateTimeLocal(data.startTime),
        registrationDeadline: formatDateTimeLocal(data.registrationDeadline),
        lateJoinDeadline: formatDateTimeLocal(data.lateJoinDeadline),
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load contest');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchContest();
  }, [fetchContest]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setContest((prev) => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: type === 'checkbox' ? checked : value,
        },
      }));
    } else {
      setContest((prev) => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!contest.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!contest.startTime) {
      setError('Start time is required');
      return;
    }
    if (contest.problems.length === 0) {
      setError('At least one problem is required');
      return;
    }

    try {
      setSaving(true);
      
      const payload = {
        ...contest,
        duration: parseInt(contest.duration),
        scoringRules: {
          ...contest.scoringRules,
          pointsPerProblem: parseInt(contest.scoringRules.pointsPerProblem),
        },
        penaltyRules: {
          ...contest.penaltyRules,
          wrongSubmissionPenalty: parseInt(contest.penaltyRules.wrongSubmissionPenalty),
        },
      };

      if (isEditing) {
        await adminContestApi.updateContest(id, payload);
      } else {
        await adminContestApi.createContest(payload);
      }

      navigate('/admin/contests');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save contest');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">
        {isEditing ? 'Edit Contest' : 'Create Contest'}
      </h1>

      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-3 rounded mb-4">
          {error}
          <button onClick={() => setError(null)} className="float-right">×</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-gray-800 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-medium text-white mb-4">Basic Information</h2>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Title *
            </label>
            <input
              type="text"
              name="title"
              value={contest.title}
              onChange={handleChange}
              className="w-full bg-gray-700 text-white px-3 py-2 rounded"
              placeholder="Weekly Contest #1"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={contest.description}
              onChange={handleChange}
              rows={4}
              className="w-full bg-gray-700 text-white px-3 py-2 rounded"
              placeholder="Contest rules and description..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Start Time *
              </label>
              <input
                type="datetime-local"
                name="startTime"
                value={contest.startTime}
                onChange={handleChange}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Duration (minutes) *
              </label>
              <input
                type="number"
                name="duration"
                value={contest.duration}
                onChange={handleChange}
                min={15}
                max={480}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Visibility
              </label>
              <select
                name="visibility"
                value={contest.visibility}
                onChange={handleChange}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded"
              >
                <option value="public">Public</option>
                <option value="private">Private (Invite Only)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Registration Deadline
              </label>
              <input
                type="datetime-local"
                name="registrationDeadline"
                value={contest.registrationDeadline}
                onChange={handleChange}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded"
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="registrationRequired"
                checked={contest.registrationRequired}
                onChange={handleChange}
                className="rounded bg-gray-700"
              />
              <span className="text-gray-300">Require Registration</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="allowLateJoin"
                checked={contest.allowLateJoin}
                onChange={handleChange}
                className="rounded bg-gray-700"
              />
              <span className="text-gray-300">Allow Late Join</span>
            </label>
          </div>
        </div>

        {/* Scoring Rules */}
        <div className="bg-gray-800 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-medium text-white mb-4">Scoring Rules</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Scoring Type
              </label>
              <select
                name="scoringRules.type"
                value={contest.scoringRules.type}
                onChange={handleChange}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded"
              >
                <option value="icpc">ICPC Style (Problems + Time)</option>
                <option value="ioi">IOI Style (Points)</option>
                <option value="leetcode">LeetCode Style (Speed Bonus)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Base Points Per Problem
              </label>
              <input
                type="number"
                name="scoringRules.pointsPerProblem"
                value={contest.scoringRules.pointsPerProblem}
                onChange={handleChange}
                min={1}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded"
              />
            </div>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="scoringRules.partialScoring"
              checked={contest.scoringRules.partialScoring}
              onChange={handleChange}
              className="rounded bg-gray-700"
            />
            <span className="text-gray-300">Enable Partial Scoring</span>
          </label>
        </div>

        {/* Penalty Rules */}
        <div className="bg-gray-800 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-medium text-white mb-4">Penalty Rules</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Wrong Submission Penalty (minutes)
              </label>
              <input
                type="number"
                name="penaltyRules.wrongSubmissionPenalty"
                value={contest.penaltyRules.wrongSubmissionPenalty}
                onChange={handleChange}
                min={0}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Penalty Unit
              </label>
              <select
                name="penaltyRules.penaltyUnit"
                value={contest.penaltyRules.penaltyUnit}
                onChange={handleChange}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded"
              >
                <option value="minutes">Minutes</option>
                <option value="seconds">Seconds</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="penaltyRules.timeBasedPenalty"
              checked={contest.penaltyRules.timeBasedPenalty}
              onChange={handleChange}
              className="rounded bg-gray-700"
            />
            <span className="text-gray-300">Enable Time-Based Penalty</span>
          </label>
        </div>

        {/* Problems */}
        <div className="bg-gray-800 rounded-lg p-6">
          <ProblemSelector
            selected={contest.problems}
            onChange={(problems) => setContest((prev) => ({ ...prev, problems }))}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate('/admin/contests')}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white rounded transition-colors"
          >
            {saving ? 'Saving...' : isEditing ? 'Update Contest' : 'Create Contest'}
          </button>
        </div>
      </form>
    </div>
  );
}
