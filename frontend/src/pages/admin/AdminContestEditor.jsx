import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Trophy,
  ArrowLeft,
  Save,
  Loader2,
  AlertTriangle,
  Search,
  X,
  Clock,
  Users,
  Settings,
  FileText,
  Calendar,
} from 'lucide-react';
import adminContestApi from '../../services/admin/adminContestApi';

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
    
    const label = String.fromCharCode(65 + selected.length); 
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
    
    onChange(updated.map((p, i) => ({ ...p, label: String.fromCharCode(65 + i) })));
  };

  const updatePoints = (index, points) => {
    const updated = [...selected];
    updated[index] = { ...updated[index], points: parseInt(points) || 0 };
    onChange(updated);
  };

  const getDifficultyStyle = (difficulty) => {
    switch (difficulty) {
      case 'Easy':
        return 'bg-[#78716C]/10 text-[#78716C] border-[#78716C]/20';
      case 'Medium':
        return 'bg-[#D97706]/10 text-[#D97706] border-[#D97706]/20';
      case 'Hard':
        return 'bg-[#92400E]/10 text-[#92400E] border-[#92400E]/20';
      default:
        return 'bg-[#78716C]/10 text-[#78716C] border-[#78716C]/20';
    }
  };

  return (
    <div className="space-y-4" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-0.5 h-4 bg-gradient-to-b from-[#D97706]/50 to-transparent rounded-full" />
        <label className="text-xs font-medium text-[#78716C] uppercase tracking-widest">
          Contest Problems
        </label>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#78716C]" />
        <input
          type="text"
          placeholder="Search problems to add..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-xl border border-[#1A1814] bg-[#0A0A08] text-[#E8E4D9] placeholder-[#78716C] focus:outline-none focus:border-[#D97706]/50 focus:ring-2 focus:ring-[#D97706]/20 transition-all"
        />
        
        {/* Search Results */}
        {problems.length > 0 && (
          <div className="absolute z-10 w-full mt-2 bg-[#0F0F0D] border border-[#1A1814] rounded-xl shadow-2xl max-h-60 overflow-y-auto">
            {problems.map((problem) => (
              <button
                key={problem._id}
                onClick={() => addProblem(problem)}
                className="w-full px-4 py-3 text-left hover:bg-[#1A1814] text-[#E8E4D9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between border-b border-[#1A1814] last:border-b-0"
                disabled={selected.find((p) => p.questionId === problem._id)}
              >
                <span className="font-medium">{problem.title}</span>
                <span className={`px-2 py-0.5 rounded-lg text-xs font-medium border ${getDifficultyStyle(problem.difficulty)}`}>
                  {problem.difficulty}
                </span>
              </button>
            ))}
          </div>
        )}
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-[#D97706]" />
          </div>
        )}
      </div>

      {}
      {selected.length > 0 ? (
        <div className="space-y-2">
          {selected.map((problem, index) => (
            <motion.div
              key={problem.questionId}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-4 p-4 rounded-xl border border-[#1A1814] bg-[#0A0A08] hover:border-[#D97706]/30 transition-colors"
            >
              <span className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#D97706]/10 text-[#D97706] font-bold text-lg">
                {problem.label}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[#E8E4D9] font-medium truncate">{problem.title}</p>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-lg text-xs font-medium border ${getDifficultyStyle(problem.difficulty)}`}>
                  {problem.difficulty}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-[#78716C] uppercase tracking-wider">Points:</label>
                <input
                  type="number"
                  value={problem.points}
                  onChange={(e) => updatePoints(index, e.target.value)}
                  className="w-20 px-3 py-2 rounded-lg border border-[#1A1814] bg-[#0F0F0D] text-[#E8E4D9] text-sm focus:outline-none focus:border-[#D97706]/50 transition-colors"
                />
              </div>
              <button
                onClick={() => removeProblem(index)}
                className="p-2 text-[#78716C] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 rounded-xl border border-dashed border-[#1A1814] bg-[#0A0A08]">
          <FileText className="h-8 w-8 text-[#78716C] mx-auto mb-2" />
          <p className="text-[#78716C] text-sm">No problems added yet. Search and add problems above.</p>
        </div>
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
    <div className="max-w-4xl mx-auto space-y-8" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
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
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-6 bg-gradient-to-b from-[#D97706] to-transparent rounded-full" />
            <h1 className="text-2xl font-bold text-[#E8E4D9] tracking-wide">
              {isEditing ? 'Edit Contest' : 'Create Contest'}
            </h1>
          </div>
          <p className="text-[#78716C] text-sm uppercase tracking-widest ml-3">
            {isEditing ? 'Update contest details' : 'Set up a new competition'}
          </p>
        </div>
      </motion.div>

      {/* Error Alert */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <AlertTriangle className="h-4 w-4 text-red-400" />
            </div>
            <span className="text-red-400 text-sm">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="p-1 hover:bg-red-500/10 rounded text-red-400 transition-colors">×</button>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-6 space-y-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-[#D97706]/10">
              <Trophy className="h-4 w-4 text-[#D97706]" />
            </div>
            <h2 className="text-sm font-medium text-[#E8E4D9] uppercase tracking-widest">Basic Information</h2>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-[#78716C] uppercase tracking-widest mb-2">
              Title *
            </label>
            <input
              type="text"
              name="title"
              value={contest.title}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-xl border border-[#1A1814] bg-[#0A0A08] text-[#E8E4D9] placeholder-[#78716C] focus:outline-none focus:border-[#D97706]/50 focus:ring-2 focus:ring-[#D97706]/20 transition-all"
              placeholder="Weekly Contest #1"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#78716C] uppercase tracking-widest mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={contest.description}
              onChange={handleChange}
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-[#1A1814] bg-[#0A0A08] text-[#E8E4D9] placeholder-[#78716C] focus:outline-none focus:border-[#D97706]/50 focus:ring-2 focus:ring-[#D97706]/20 transition-all resize-none"
              placeholder="Contest rules and description..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-[#78716C] uppercase tracking-widest mb-2">
                <Calendar className="inline h-3 w-3 mr-1" />Start Time *
              </label>
              <input
                type="datetime-local"
                name="startTime"
                value={contest.startTime}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-[#1A1814] bg-[#0A0A08] text-[#E8E4D9] focus:outline-none focus:border-[#D97706]/50 focus:ring-2 focus:ring-[#D97706]/20 transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#78716C] uppercase tracking-widest mb-2">
                <Clock className="inline h-3 w-3 mr-1" />Duration (minutes) *
              </label>
              <input
                type="number"
                name="duration"
                value={contest.duration}
                onChange={handleChange}
                min={15}
                max={480}
                className="w-full px-4 py-3 rounded-xl border border-[#1A1814] bg-[#0A0A08] text-[#E8E4D9] focus:outline-none focus:border-[#D97706]/50 focus:ring-2 focus:ring-[#D97706]/20 transition-all"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-[#78716C] uppercase tracking-widest mb-2">
                <Users className="inline h-3 w-3 mr-1" />Visibility
              </label>
              <select
                name="visibility"
                value={contest.visibility}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-[#1A1814] bg-[#0A0A08] text-[#E8E4D9] focus:outline-none focus:border-[#D97706]/50 focus:ring-2 focus:ring-[#D97706]/20 transition-all appearance-none cursor-pointer"
              >
                <option value="public">Public</option>
                <option value="private">Private (Invite Only)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#78716C] uppercase tracking-widest mb-2">
                Registration Deadline
              </label>
              <input
                type="datetime-local"
                name="registrationDeadline"
                value={contest.registrationDeadline}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-[#1A1814] bg-[#0A0A08] text-[#E8E4D9] focus:outline-none focus:border-[#D97706]/50 focus:ring-2 focus:ring-[#D97706]/20 transition-all"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-2">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                name="registrationRequired"
                checked={contest.registrationRequired}
                onChange={handleChange}
                className="w-5 h-5 rounded border-2 border-[#1A1814] bg-[#0A0A08] text-[#D97706] focus:ring-[#D97706]/50 focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-sm text-[#78716C] group-hover:text-[#E8E4D9] transition-colors">Require Registration</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                name="allowLateJoin"
                checked={contest.allowLateJoin}
                onChange={handleChange}
                className="w-5 h-5 rounded border-2 border-[#1A1814] bg-[#0A0A08] text-[#D97706] focus:ring-[#D97706]/50 focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-sm text-[#78716C] group-hover:text-[#E8E4D9] transition-colors">Allow Late Join</span>
            </label>
          </div>
        </motion.div>

        {/* Scoring Rules */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-6 space-y-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-[#D97706]/10">
              <Settings className="h-4 w-4 text-[#D97706]" />
            </div>
            <h2 className="text-sm font-medium text-[#E8E4D9] uppercase tracking-widest">Scoring Rules</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-[#78716C] uppercase tracking-widest mb-2">
                Scoring Type
              </label>
              <select
                name="scoringRules.type"
                value={contest.scoringRules.type}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-[#1A1814] bg-[#0A0A08] text-[#E8E4D9] focus:outline-none focus:border-[#D97706]/50 focus:ring-2 focus:ring-[#D97706]/20 transition-all appearance-none cursor-pointer"
              >
                <option value="icpc">ICPC Style (Problems + Time)</option>
                <option value="ioi">IOI Style (Points)</option>
                <option value="leetcode">LeetCode Style (Speed Bonus)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#78716C] uppercase tracking-widest mb-2">
                Base Points Per Problem
              </label>
              <input
                type="number"
                name="scoringRules.pointsPerProblem"
                value={contest.scoringRules.pointsPerProblem}
                onChange={handleChange}
                min={1}
                className="w-full px-4 py-3 rounded-xl border border-[#1A1814] bg-[#0A0A08] text-[#E8E4D9] focus:outline-none focus:border-[#D97706]/50 focus:ring-2 focus:ring-[#D97706]/20 transition-all"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              name="scoringRules.partialScoring"
              checked={contest.scoringRules.partialScoring}
              onChange={handleChange}
              className="w-5 h-5 rounded border-2 border-[#1A1814] bg-[#0A0A08] text-[#D97706] focus:ring-[#D97706]/50 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-sm text-[#78716C] group-hover:text-[#E8E4D9] transition-colors">Enable Partial Scoring</span>
          </label>
        </motion.div>

        {/* Penalty Rules */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-6 space-y-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-[#92400E]/10">
              <AlertTriangle className="h-4 w-4 text-[#92400E]" />
            </div>
            <h2 className="text-sm font-medium text-[#E8E4D9] uppercase tracking-widest">Penalty Rules</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-[#78716C] uppercase tracking-widest mb-2">
                Wrong Submission Penalty
              </label>
              <input
                type="number"
                name="penaltyRules.wrongSubmissionPenalty"
                value={contest.penaltyRules.wrongSubmissionPenalty}
                onChange={handleChange}
                min={0}
                className="w-full px-4 py-3 rounded-xl border border-[#1A1814] bg-[#0A0A08] text-[#E8E4D9] focus:outline-none focus:border-[#D97706]/50 focus:ring-2 focus:ring-[#D97706]/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#78716C] uppercase tracking-widest mb-2">
                Penalty Unit
              </label>
              <select
                name="penaltyRules.penaltyUnit"
                value={contest.penaltyRules.penaltyUnit}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-[#1A1814] bg-[#0A0A08] text-[#E8E4D9] focus:outline-none focus:border-[#D97706]/50 focus:ring-2 focus:ring-[#D97706]/20 transition-all appearance-none cursor-pointer"
              >
                <option value="minutes">Minutes</option>
                <option value="seconds">Seconds</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              name="penaltyRules.timeBasedPenalty"
              checked={contest.penaltyRules.timeBasedPenalty}
              onChange={handleChange}
              className="w-5 h-5 rounded border-2 border-[#1A1814] bg-[#0A0A08] text-[#D97706] focus:ring-[#D97706]/50 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-sm text-[#78716C] group-hover:text-[#E8E4D9] transition-colors">Enable Time-Based Penalty</span>
          </label>
        </motion.div>

        {/* Problems */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-6"
        >
          <ProblemSelector
            selected={contest.problems}
            onChange={(problems) => setContest((prev) => ({ ...prev, problems }))}
          />
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="flex justify-end gap-4"
        >
          <button
            type="button"
            onClick={() => navigate('/admin/contests')}
            className="px-6 py-3 rounded-xl border border-[#1A1814] bg-[#0F0F0D] hover:border-[#78716C]/50 text-[#E8E4D9] font-medium transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#D97706] to-amber-600 hover:from-[#D97706]/90 hover:to-amber-600/90 disabled:from-[#1A1814] disabled:to-[#1A1814] text-white font-medium transition-all shadow-lg shadow-[#D97706]/20 disabled:shadow-none disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {isEditing ? 'Update Contest' : 'Create Contest'}
              </>
            )}
          </button>
        </motion.div>
      </form>
    </div>
  );
}
