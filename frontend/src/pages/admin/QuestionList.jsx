import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
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

  const getDifficultyBadge = (difficulty) => {
    const colors = {
      Easy: "bg-green-500/20 text-green-400",
      Medium: "bg-yellow-500/20 text-yellow-400",
      Hard: "bg-red-500/20 text-red-400",
    };
    return colors[difficulty] || "bg-gray-500/20 text-gray-400";
  };

  return (
    <div className="space-y-6">
      {}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Questions</h1>
          <p className="text-gray-400 mt-1">
            {pagination.total} total questions
          </p>
        </div>
        <Link
          to="/admin/questions/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium hover:from-orange-600 hover:to-amber-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Question
        </Link>
      </div>

      {}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search questions..."
            value={search}
            onChange={(e) => handleFilterChange("search", e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <select
            value={difficulty}
            onChange={(e) => handleFilterChange("difficulty", e.target.value)}
            className="pl-10 pr-8 py-2 rounded-lg bg-gray-800/50 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 appearance-none cursor-pointer"
          >
            <option value="">All Difficulties</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>
        </div>
      </div>

      {}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <span className="text-red-400">{error}</span>
        </div>
      )}

      {}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">No questions found</p>
          <Link
            to="/admin/questions/new"
            className="inline-flex items-center gap-2 mt-4 text-orange-400 hover:text-orange-300"
          >
            <Plus className="h-4 w-4" />
            Create your first question
          </Link>
        </div>
      ) : (
        <>
          {}
          <div className="overflow-x-auto rounded-xl border border-gray-700">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                    Title
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                    Difficulty
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-400">
                    AI Ready
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-400">
                    Test Cases
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {questions.map((question) => (
                  <tr
                    key={question._id}
                    className="hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="px-4 py-4">
                      <div>
                        <Link
                          to={`/admin/questions/${question._id}`}
                          className="text-white hover:text-orange-400 font-medium transition-colors"
                        >
                          {question.title}
                        </Link>
                        {question.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {question.tags.slice(0, 3).map((tag, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-400"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${getDifficultyBadge(question.difficulty)}`}
                      >
                        {question.difficulty}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {question.topic &&
                      question.canonicalAlgorithms?.length > 0 ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-500/20 text-green-400 text-xs"
                          title={`Topic: ${question.topic}`}
                        >
                          <Bot className="h-3 w-3" />
                          Ready
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 text-xs"
                          title="Missing AI metadata"
                        >
                          <Bot className="h-3 w-3" />
                          Needs Data
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-white">
                          {question.testCases?.total || 0}
                        </span>
                        {question.testCases?.hidden > 0 && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <EyeOff className="h-3 w-3" />
                            {question.testCases.hidden}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/admin/questions/${question._id}`}
                          className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <Link
                          to={`/admin/questions/${question._id}/edit`}
                          className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => setDeleteConfirm(question._id)}
                          className="p-2 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="px-4 py-2 text-gray-400">
                Page {currentPage} of {pagination.pages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= pagination.pages}
                className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </>
      )}

      {}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-2">
              Delete Question?
            </h3>
            <p className="text-gray-400 mb-6">
              This action cannot be undone. All associated test cases will also
              be deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionList;
