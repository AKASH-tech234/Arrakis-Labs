import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { getQuestions, deleteQuestion } from "../../services/admin/adminApi";
import {
  FileText,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  CheckCircle,
  EyeOff,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Bot,
} from "lucide-react";

const QuestionList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [questions, setQuestions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const currentPage = parseInt(searchParams.get("page") || "1");
  const difficulty = searchParams.get("difficulty") || "";
  const search = searchParams.get("search") || "";

  useEffect(() => {
    const fetchQuestions = async () => {
      setLoading(true);
      try {
        const response = await getQuestions({
          page: currentPage,
          limit: 15,
          difficulty: difficulty || undefined,
          search: search || undefined,
        });
        if (response.success) {
          setQuestions(response.data);
          setPagination(response.pagination);
        }
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load questions");
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, [currentPage, difficulty, search]);

  const handleDelete = async (id) => {
    try {
      await deleteQuestion(id);
      setQuestions(questions.filter((q) => q._id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete question");
    }
  };

  const handleFilterChange = (key, value) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.set("page", "1");
    setSearchParams(newParams);
  };

  const handlePageChange = (newPage) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("page", String(newPage));
    setSearchParams(newParams);
  };

  const getDifficultyStyle = (difficulty) => {
    const styles = {
      Easy: "text-[#78716C]",
      Medium: "text-[#D97706]",
      Hard: "text-[#92400E]",
    };
    return styles[difficulty] || "text-[#78716C]";
  };

  const getDifficultyBadge = (difficulty) => {
    const colors = {
      Easy: "bg-[#78716C]/10 text-[#78716C] border-[#78716C]/20",
      Medium: "bg-[#D97706]/10 text-[#D97706] border-[#D97706]/20",
      Hard: "bg-[#92400E]/10 text-[#92400E] border-[#92400E]/20",
    };
    return colors[difficulty] || "bg-[#78716C]/10 text-[#78716C] border-[#78716C]/20";
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-6 bg-gradient-to-b from-[#D97706] to-transparent rounded-full"></div>
            <h1 
              className="text-2xl font-bold text-[#E8E4D9] tracking-wide"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Questions
            </h1>
          </div>
          <p 
            className="text-[#78716C] text-xs uppercase tracking-widest ml-3"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {pagination.total} total questions
          </p>
        </div>
        <Link
          to="/admin/questions/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#D97706] to-[#F59E0B] text-[#0A0A08] font-semibold hover:from-[#F59E0B] hover:to-[#FBBF24] transition-all duration-300 shadow-lg shadow-[#D97706]/20"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          <Plus className="h-4 w-4" />
          New Question
        </Link>
      </motion.div>

      {/* Filters Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-4"
      >
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#78716C]" />
          <input
            type="text"
            placeholder="Search questions..."
            value={search}
            onChange={(e) => handleFilterChange("search", e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-[#1A1814] bg-[#0F0F0D] text-[#E8E4D9] placeholder-[#78716C] focus:outline-none focus:border-[#D97706]/50 transition-colors"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#78716C]" />
          <select
            value={difficulty}
            onChange={(e) => handleFilterChange("difficulty", e.target.value)}
            className="pl-11 pr-8 py-3 rounded-xl border border-[#1A1814] bg-[#0F0F0D] text-[#E8E4D9] focus:outline-none focus:border-[#D97706]/50 appearance-none cursor-pointer transition-colors"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            <option value="">All Difficulties</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>
        </div>
      </motion.div>

      {/* Error Display */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 flex items-center gap-3"
        >
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <span 
            className="text-red-400"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {error}
          </span>
        </motion.div>
      )}

      {/* Questions List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-[#D97706]" />
        </div>
      ) : questions.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16 rounded-xl border border-[#1A1814] bg-[#0F0F0D]"
        >
          <FileText className="h-12 w-12 text-[#78716C] mx-auto mb-4" />
          <p 
            className="text-[#78716C] uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            No questions found
          </p>
          <Link
            to="/admin/questions/new"
            className="inline-flex items-center gap-2 mt-4 text-[#D97706] hover:text-[#F59E0B] transition-colors"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            <Plus className="h-4 w-4" />
            Create your first question
          </Link>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          {/* Table Header */}
          <div className="flex items-center justify-between gap-4 py-4 px-5 border-b border-[#1A1814] mb-2">
            <div className="flex items-center gap-6 flex-1">
              <span
                className="text-[#78716C] text-[10px] uppercase tracking-widest font-semibold w-[40%]"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Title
              </span>
              <span
                className="text-[#78716C] text-[10px] uppercase tracking-widest font-semibold w-20 text-center"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Difficulty
              </span>
              <span
                className="text-[#78716C] text-[10px] uppercase tracking-widest font-semibold w-24 text-center hidden md:block"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                AI Status
              </span>
              <span
                className="text-[#78716C] text-[10px] uppercase tracking-widest font-semibold w-24 text-center hidden sm:block"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Test Cases
              </span>
            </div>
            <span
              className="text-[#78716C] text-[10px] uppercase tracking-widest font-semibold w-28 text-right"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Actions
            </span>
          </div>

          {/* Question Rows */}
          <div className="space-y-2">
            {questions.map((question, index) => (
              <motion.div
                key={question._id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.03 }}
                className="group relative overflow-hidden rounded-xl border border-[#1A1814] bg-[#0F0F0D] hover:border-[#D97706]/40 transition-all duration-300"
              >
                {/* Top accent line on hover */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#D97706] via-[#F59E0B] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div className="flex items-center justify-between gap-4 py-4 px-5">
                  <div className="flex items-center gap-6 flex-1 min-w-0">
                    {/* Title & Tags */}
                    <div className="w-[40%] min-w-0">
                      <Link
                        to={`/admin/questions/${question._id}`}
                        className="text-[#E8E4D9] hover:text-[#F59E0B] font-medium transition-colors truncate block"
                        style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                      >
                        {question.title}
                      </Link>
                      {question.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {question.tags.slice(0, 3).map((tag, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded text-[10px] bg-[#1A1814] text-[#78716C] uppercase tracking-wider"
                              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Difficulty Badge */}
                    <div className="w-20 flex justify-center">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider border ${getDifficultyBadge(question.difficulty)}`}
                        style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                      >
                        {question.difficulty}
                      </span>
                    </div>

                    {/* AI Status */}
                    <div className="w-24 justify-center hidden md:flex">
                      {question.topic && question.canonicalAlgorithms?.length > 0 ? (
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-500/10 text-green-400 text-[10px] uppercase tracking-wider border border-green-500/20"
                          title={`Topic: ${question.topic}`}
                          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                        >
                          <Bot className="h-3 w-3" />
                          Ready
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#D97706]/10 text-[#D97706] text-[10px] uppercase tracking-wider border border-[#D97706]/20"
                          title="Missing AI metadata"
                          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                        >
                          <Bot className="h-3 w-3" />
                          Needs Data
                        </span>
                      )}
                    </div>

                    {/* Test Cases */}
                    <div className="w-24 justify-center hidden sm:flex">
                      <div className="flex items-center gap-2">
                        <span 
                          className="text-[#E8E4D9] font-medium"
                          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                        >
                          {question.testCases?.total || 0}
                        </span>
                        {question.testCases?.hidden > 0 && (
                          <span className="flex items-center gap-1 text-[10px] text-[#78716C]">
                            <EyeOff className="h-3 w-3" />
                            {question.testCases.hidden}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 w-28 justify-end">
                    <Link
                      to={`/admin/questions/${question._id}`}
                      className="p-2.5 rounded-lg hover:bg-[#1A1814] text-[#78716C] hover:text-[#D97706] transition-colors"
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                    <Link
                      to={`/admin/questions/${question._id}/edit`}
                      className="p-2.5 rounded-lg hover:bg-[#1A1814] text-[#78716C] hover:text-[#D97706] transition-colors"
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={() => setDeleteConfirm(question._id)}
                      className="p-2.5 rounded-lg hover:bg-red-500/10 text-[#78716C] hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex items-center justify-center gap-3 mt-8"
            >
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="p-2.5 rounded-lg border border-[#1A1814] bg-[#0F0F0D] hover:border-[#D97706]/40 text-[#78716C] hover:text-[#D97706] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span 
                className="px-4 py-2 text-[#78716C] text-sm uppercase tracking-wider"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Page {currentPage} of {pagination.pages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= pagination.pages}
                className="p-2.5 rounded-lg border border-[#1A1814] bg-[#0F0F0D] hover:border-[#D97706]/40 text-[#78716C] hover:text-[#D97706] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-6 max-w-sm w-full mx-4 shadow-2xl"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-5 bg-gradient-to-b from-red-500 to-transparent rounded-full"></div>
              <h3 
                className="text-lg font-semibold text-[#E8E4D9]"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Delete Question?
              </h3>
            </div>
            <p 
              className="text-[#78716C] mb-6 text-sm"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              This action cannot be undone. All associated test cases will also be deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-[#1A1814] bg-[#0A0A08] hover:border-[#78716C]/50 text-[#E8E4D9] transition-colors"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 transition-colors"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default QuestionList;
