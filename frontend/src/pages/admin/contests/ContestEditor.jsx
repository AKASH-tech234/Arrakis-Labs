import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import adminApi from '../../../services/admin/adminApi';
import {
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  ChevronUp,
  ChevronDown,
  X,
  Search,
  Trophy,
  AlertTriangle,
} from 'lucide-react';

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

  return (
    <div className="max-w-5xl space-y-8" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-4"
      >
        <Link
          to="/admin/contests"
          className="p-2.5 rounded-lg border border-[#1A1814] bg-[#0F0F0D] hover:border-[#D97706]/40 text-[#78716C] hover:text-[#D97706] transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-6 bg-gradient-to-b from-[#D97706] to-transparent rounded-full" />
            <h1 className="text-2xl font-bold text-[#E8E4D9] tracking-wide">
              {isEditing ? 'Edit Contest' : 'Create Contest'}
            </h1>
          </div>
          <p className="text-[#78716C] text-sm uppercase tracking-widest ml-3">
            {isEditing ? 'Update contest settings' : 'Set up a new coding contest'}
          </p>
        </div>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 flex items-center gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <span className="text-red-400">{error}</span>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="rounded-xl border border-[#1A1814] bg-[#0A0A08] overflow-hidden"
        >
          <div className="p-4 border-b border-[#1A1814] bg-[#0F0F0D]/50">
            <h2 className="text-sm font-semibold text-[#E8E4D9] uppercase tracking-widest">Basic Information</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-[#78716C] uppercase tracking-widest mb-2">
                  Contest Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-[#1A1814] bg-[#0F0F0D] text-[#E8E4D9] placeholder-[#78716C] focus:outline-none focus:border-[#D97706]/50 focus:ring-2 focus:ring-[#D97706]/20 transition-all"
                  placeholder="Weekly Contest 123"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-[#78716C] uppercase tracking-widest mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-[#1A1814] bg-[#0F0F0D] text-[#E8E4D9] placeholder-[#78716C] focus:outline-none focus:border-[#D97706]/50 focus:ring-2 focus:ring-[#D97706]/20 transition-all resize-none"
                  placeholder="Contest description..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#78716C] uppercase tracking-widest mb-2">
                  Start Time (Local) *
                </label>
                <input
                  type="datetime-local"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-[#1A1814] bg-[#0F0F0D] text-[#E8E4D9] focus:outline-none focus:border-[#D97706]/50 focus:ring-2 focus:ring-[#D97706]/20 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#78716C] uppercase tracking-widest mb-2">
                  Duration (minutes) *
                </label>
                <input
                  type="number"
                  name="duration"
                  value={formData.duration}
                  onChange={handleChange}
                  min={5}
                  max={720}
                  className="w-full px-4 py-3 rounded-xl border border-[#1A1814] bg-[#0F0F0D] text-[#E8E4D9] focus:outline-none focus:border-[#D97706]/50 focus:ring-2 focus:ring-[#D97706]/20 transition-all"
                  required
                />
              </div>
            </div>
          </div>
        </motion.section>

        {/* Problems Section */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="rounded-xl border border-[#1A1814] bg-[#0A0A08] overflow-hidden"
        >
          <div className="p-4 border-b border-[#1A1814] bg-[#0F0F0D]/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#D97706]/10">
                <Trophy className="w-4 h-4 text-[#D97706]" />
              </div>
              <h2 className="text-sm font-semibold text-[#E8E4D9] uppercase tracking-widest">Problems</h2>
            </div>
            <span className="text-[#78716C] text-sm">{formData.problems.length} selected</span>
          </div>
          <div className="p-6">
            {/* Selected Problems */}
            {formData.problems.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-medium text-[#78716C] uppercase tracking-widest mb-3">Selected Problems</h3>
                <div className="space-y-2">
                  {formData.problems.map((problem, index) => (
                    <div
                      key={problem.problemId}
                      className="flex items-center justify-between p-3 bg-[#0F0F0D] border border-[#1A1814] rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 flex items-center justify-center bg-[#D97706] rounded-lg text-white font-bold text-sm">
                          {problem.label}
                        </span>
                        <span className="text-[#E8E4D9]">{problem.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={problem.points}
                          onChange={(e) => updateProblemPoints(problem.problemId, e.target.value)}
                          className="w-20 px-2 py-1 rounded-lg border border-[#1A1814] bg-[#0A0A08] text-[#E8E4D9] text-sm focus:outline-none focus:border-[#D97706]/50"
                          min={1}
                        />
                        <span className="text-[#78716C] text-sm">pts</span>
                        <button
                          type="button"
                          onClick={() => moveProblem(index, -1)}
                          disabled={index === 0}
                          className="p-1 text-[#78716C] hover:text-[#E8E4D9] disabled:opacity-30 transition-colors"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveProblem(index, 1)}
                          disabled={index === formData.problems.length - 1}
                          className="p-1 text-[#78716C] hover:text-[#E8E4D9] disabled:opacity-30 transition-colors"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeProblem(problem.problemId)}
                          className="p-1 text-red-400 hover:text-red-300 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Problems */}
            <div>
              <h3 className="text-xs font-medium text-[#78716C] uppercase tracking-widest mb-3">Add Problems</h3>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search problems..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#1A1814] bg-[#0F0F0D] text-[#E8E4D9] placeholder-[#78716C] focus:outline-none focus:border-[#D97706]/50 transition-all"
                />
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {filteredProblems.slice(0, 20).map((problem) => (
                  <button
                    key={problem._id}
                    type="button"
                    onClick={() => addProblem(problem)}
                    className="w-full flex items-center justify-between p-3 bg-[#0F0F0D]/50 hover:bg-[#0F0F0D] border border-transparent hover:border-[#1A1814] rounded-xl text-left transition-all"
                  >
                    <div>
                      <span className="text-[#E8E4D9]">{problem.title}</span>
                      <span className={`ml-2 text-sm ${
                        problem.difficulty === 'Easy' ? 'text-[#78716C]' :
                        problem.difficulty === 'Medium' ? 'text-[#D97706]' : 'text-[#92400E]'
                      }`}>
                        {problem.difficulty}
                      </span>
                    </div>
                    <span className="text-[#D97706] text-sm font-medium flex items-center gap-1">
                      <Plus className="w-4 h-4" /> Add
                    </span>
                  </button>
                ))}
                {filteredProblems.length === 0 && (
                  <p className="text-[#78716C] text-center py-4">No problems found</p>
                )}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Scoring & Rules Section */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="rounded-xl border border-[#1A1814] bg-[#0A0A08] overflow-hidden"
        >
          <div className="p-4 border-b border-[#1A1814] bg-[#0F0F0D]/50">
            <h2 className="text-sm font-semibold text-[#E8E4D9] uppercase tracking-widest">Scoring & Rules</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-medium text-[#78716C] uppercase tracking-widest mb-2">
                  Default Points per Problem
                </label>
                <input
                  type="number"
                  name="scoringRules.defaultPoints"
                  value={formData.scoringRules.defaultPoints}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-[#1A1814] bg-[#0F0F0D] text-[#E8E4D9] focus:outline-none focus:border-[#D97706]/50 focus:ring-2 focus:ring-[#D97706]/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#78716C] uppercase tracking-widest mb-2">
                  Wrong Submission Penalty (minutes)
                </label>
                <input
                  type="number"
                  name="penaltyRules.wrongSubmissionPenalty"
                  value={formData.penaltyRules.wrongSubmissionPenalty}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-[#1A1814] bg-[#0F0F0D] text-[#E8E4D9] focus:outline-none focus:border-[#D97706]/50 focus:ring-2 focus:ring-[#D97706]/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#78716C] uppercase tracking-widest mb-2">
                  Ranking Type
                </label>
                <select
                  name="rankingType"
                  value={formData.rankingType}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-[#1A1814] bg-[#0F0F0D] text-[#E8E4D9] focus:outline-none focus:border-[#D97706]/50 focus:ring-2 focus:ring-[#D97706]/20 transition-all"
                >
                  <option value="lcb">LeetCode Style</option>
                  <option value="icpc">ICPC Style</option>
                  <option value="ioi">IOI Style</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#78716C] uppercase tracking-widest mb-2">
                  Late Join Deadline (minutes after start)
                </label>
                <input
                  type="number"
                  name="lateJoinDeadline"
                  value={formData.lateJoinDeadline}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-[#1A1814] bg-[#0F0F0D] text-[#E8E4D9] focus:outline-none focus:border-[#D97706]/50 focus:ring-2 focus:ring-[#D97706]/20 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <label className="flex items-center gap-2 cursor-pointer p-3 rounded-xl bg-[#0F0F0D] border border-[#1A1814] hover:border-[#D97706]/40 transition-all">
                <input
                  type="checkbox"
                  name="isPublic"
                  checked={formData.isPublic}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-[#1A1814] text-[#D97706] focus:ring-[#D97706] bg-[#0A0A08]"
                />
                <span className="text-[#E8E4D9] text-sm">Public Contest</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-3 rounded-xl bg-[#0F0F0D] border border-[#1A1814] hover:border-[#D97706]/40 transition-all">
                <input
                  type="checkbox"
                  name="requiresRegistration"
                  checked={formData.requiresRegistration}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-[#1A1814] text-[#D97706] focus:ring-[#D97706] bg-[#0A0A08]"
                />
                <span className="text-[#E8E4D9] text-sm">Require Registration</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-3 rounded-xl bg-[#0F0F0D] border border-[#1A1814] hover:border-[#D97706]/40 transition-all">
                <input
                  type="checkbox"
                  name="allowLateJoin"
                  checked={formData.allowLateJoin}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-[#1A1814] text-[#D97706] focus:ring-[#D97706] bg-[#0A0A08]"
                />
                <span className="text-[#E8E4D9] text-sm">Allow Late Join</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-3 rounded-xl bg-[#0F0F0D] border border-[#1A1814] hover:border-[#D97706]/40 transition-all">
                <input
                  type="checkbox"
                  name="showLeaderboardDuringContest"
                  checked={formData.showLeaderboardDuringContest}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-[#1A1814] text-[#D97706] focus:ring-[#D97706] bg-[#0A0A08]"
                />
                <span className="text-[#E8E4D9] text-sm">Show Leaderboard</span>
              </label>
            </div>
          </div>
        </motion.section>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="flex items-center justify-end gap-4"
        >
          <Link
            to="/admin/contests"
            className="px-6 py-3 rounded-xl border border-[#1A1814] bg-[#0F0F0D] text-[#78716C] hover:text-[#E8E4D9] hover:border-[#78716C]/50 font-semibold uppercase tracking-wider text-sm transition-all"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#D97706] to-[#F59E0B] hover:from-[#B45309] hover:to-[#D97706] text-white font-semibold uppercase tracking-wider text-sm disabled:opacity-50 transition-all"
          >
            {saving && <Loader2 className="animate-spin h-5 w-5" />}
            <Save className="w-5 h-5" />
            {isEditing ? 'Save Changes' : 'Create Contest'}
          </button>
        </motion.div>
      </form>
    </div>
  );
}
