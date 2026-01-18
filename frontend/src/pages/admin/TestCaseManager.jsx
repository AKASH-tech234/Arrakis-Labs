import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  getQuestionById,
  getTestCases,
  createTestCase,
  updateTestCase,
  deleteTestCase,
  toggleTestCaseHidden,
} from "../../services/adminApi";
import {
  ArrowLeft,
  Plus,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  Save,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

const TestCaseManager = () => {
  const { id: questionId } = useParams();

  const [question, setQuestion] = useState(null);
  const [testCases, setTestCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState({
    stdin: "",
    expectedStdout: "",
    isHidden: true,
    label: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [questionRes, testCasesRes] = await Promise.all([
          getQuestionById(questionId),
          getTestCases(questionId),
        ]);

        if (questionRes.success) {
          setQuestion(questionRes.data);
        }
        if (testCasesRes.success) {
          setTestCases(testCasesRes.data);
        }
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [questionId]);

  const handleToggleHidden = async (testCaseId) => {
    try {
      const response = await toggleTestCaseHidden(testCaseId);
      if (response.success) {
        setTestCases(testCases.map(tc => 
          tc.id === testCaseId ? { ...tc, isHidden: response.data.isHidden } : tc
        ));
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to toggle visibility");
    }
  };

  const handleDelete = async (testCaseId) => {
    if (!confirm("Are you sure you want to delete this test case?")) return;
    
    try {
      await deleteTestCase(testCaseId);
      setTestCases(testCases.filter(tc => tc.id !== testCaseId));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete test case");
    }
  };

  const startEditing = (testCase) => {
    setEditingId(testCase.id);
    setEditForm({
      stdin: testCase.stdin,
      expectedStdout: testCase.expectedStdout,
      isHidden: testCase.isHidden,
      label: testCase.label,
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const response = await updateTestCase(editingId, editForm);
      if (response.success) {
        setTestCases(testCases.map(tc =>
          tc.id === editingId ? { ...tc, ...response.data } : tc
        ));
        setEditingId(null);
        setEditForm(null);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update test case");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNew = async () => {
    if (!newForm.stdin.trim() || !newForm.expectedStdout.trim()) {
      setError("stdin and expectedStdout are required");
      return;
    }

    setSaving(true);
    try {
      const response = await createTestCase(questionId, {
        stdin: newForm.stdin,
        expectedStdout: newForm.expectedStdout,
        isHidden: newForm.isHidden,
        label: newForm.label || `Test Case ${testCases.length + 1}`,
      });

      if (response.success) {
        setTestCases([...testCases, response.data]);
        setShowNewForm(false);
        setNewForm({ stdin: "", expectedStdout: "", isHidden: true, label: "" });
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create test case");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/admin/questions"
          className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Test Cases</h1>
          <p className="text-gray-400 mt-1">{question?.title}</p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium hover:from-orange-600 hover:to-amber-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Test Case
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <span className="text-red-400">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Security Notice */}
      <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <p className="text-sm text-amber-400">
          ⚠️ <strong>Hidden test cases</strong> are never exposed to users. They only see pass/fail results during submission.
          <br />
          <strong>Visible test cases</strong> are shown to users during "Run" to help with debugging.
        </p>
      </div>

      {/* New Test Case Form */}
      {showNewForm && (
        <div className="p-6 rounded-xl bg-gray-800/50 border border-gray-700 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">New Test Case</h3>
            <button
              onClick={() => setShowNewForm(false)}
              className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Label</label>
            <input
              type="text"
              value={newForm.label}
              onChange={(e) => setNewForm({ ...newForm, label: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-gray-900/50 border border-gray-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Test Case 1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">stdin *</label>
              <textarea
                value={newForm.stdin}
                onChange={(e) => setNewForm({ ...newForm, stdin: e.target.value })}
                rows={5}
                className="w-full px-3 py-2 rounded-lg bg-gray-900/50 border border-gray-600 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="4&#10;2 7 11 15&#10;9"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Expected stdout *</label>
              <textarea
                value={newForm.expectedStdout}
                onChange={(e) => setNewForm({ ...newForm, expectedStdout: e.target.value })}
                rows={5}
                className="w-full px-3 py-2 rounded-lg bg-gray-900/50 border border-gray-600 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="0 1"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setNewForm({ ...newForm, isHidden: !newForm.isHidden })}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                newForm.isHidden
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "bg-green-500/20 text-green-400 border border-green-500/30"
              }`}
            >
              {newForm.isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {newForm.isHidden ? "Hidden" : "Visible"}
            </button>
            <span className="text-sm text-gray-500">
              {newForm.isHidden ? "Users won't see the input/output" : "Users can see this test case"}
            </span>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowNewForm(false)}
              className="flex-1 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateNew}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Create
            </button>
          </div>
        </div>
      )}

      {/* Test Cases List */}
      {testCases.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">No test cases yet</p>
          <button
            onClick={() => setShowNewForm(true)}
            className="inline-flex items-center gap-2 mt-4 text-orange-400 hover:text-orange-300"
          >
            <Plus className="h-4 w-4" />
            Add your first test case
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {testCases.map((tc, index) => (
            <div
              key={tc.id}
              className="p-4 rounded-xl bg-gray-800/50 border border-gray-700"
            >
              {editingId === tc.id ? (
                // Edit Form
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Label</label>
                    <input
                      type="text"
                      value={editForm.label}
                      onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-gray-900/50 border border-gray-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">stdin</label>
                      <textarea
                        value={editForm.stdin}
                        onChange={(e) => setEditForm({ ...editForm, stdin: e.target.value })}
                        rows={5}
                        className="w-full px-3 py-2 rounded-lg bg-gray-900/50 border border-gray-600 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Expected stdout</label>
                      <textarea
                        value={editForm.expectedStdout}
                        onChange={(e) => setEditForm({ ...editForm, expectedStdout: e.target.value })}
                        rows={5}
                        className="w-full px-3 py-2 rounded-lg bg-gray-900/50 border border-gray-600 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditForm({ ...editForm, isHidden: !editForm.isHidden })}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                        editForm.isHidden
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : "bg-green-500/20 text-green-400 border border-green-500/30"
                      }`}
                    >
                      {editForm.isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      {editForm.isHidden ? "Hidden" : "Visible"}
                    </button>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={cancelEditing}
                      className="flex-1 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 transition-colors"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                // Display
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-white font-medium">{tc.label || `Test Case ${index + 1}`}</span>
                      <button
                        onClick={() => handleToggleHidden(tc.id)}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                          tc.isHidden
                            ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                            : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                        }`}
                      >
                        {tc.isHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        {tc.isHidden ? "Hidden" : "Visible"}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEditing(tc)}
                        className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(tc.id)}
                        className="p-2 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">stdin</label>
                      <pre className="p-3 rounded-lg bg-gray-900/50 text-gray-300 text-sm font-mono whitespace-pre-wrap max-h-32 overflow-auto">
                        {tc.stdin}
                      </pre>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Expected stdout</label>
                      <pre className="p-3 rounded-lg bg-gray-900/50 text-gray-300 text-sm font-mono whitespace-pre-wrap max-h-32 overflow-auto">
                        {tc.expectedStdout}
                      </pre>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TestCaseManager;
