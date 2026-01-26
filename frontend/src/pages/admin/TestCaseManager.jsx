import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  getQuestionById,
  getTestCases,
  createTestCase,
  updateTestCase,
  deleteTestCase,
  toggleTestCaseHidden,
} from "../../services/admin/adminApi";
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
  FileCode2,
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
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="h-10 w-10 animate-spin text-[#D97706]" />
        <p className="text-[#78716C] mt-4">Loading test cases...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
      {}
      <div className="flex items-center gap-4">
        <Link
          to="/admin/questions"
          className="p-2 rounded-lg hover:bg-[#1A1814] text-[#78716C] hover:text-[#E8E4D9] transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 flex items-center gap-3">
          <div className="w-1 h-8 bg-gradient-to-b from-[#D97706] to-[#D97706]/20 rounded-full" />
          <div>
            <h1 className="text-2xl font-bold text-[#E8E4D9] uppercase tracking-wider flex items-center gap-2">
              <FileCode2 className="h-6 w-6 text-[#D97706]" />
              Test Cases
            </h1>
            <p className="text-sm text-[#78716C]">{question?.title}</p>
          </div>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#D97706] to-amber-600 text-white font-medium hover:from-[#D97706]/90 hover:to-amber-600/90 transition-all shadow-lg shadow-[#D97706]/20"
        >
          <Plus className="h-4 w-4" />
          Add Test Case
        </button>
      </div>

      {}
      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3"
        >
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <span className="text-red-400">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-300 p-1 hover:bg-red-500/20 rounded-lg transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}

      {}
      <div className="p-4 rounded-xl bg-[#D97706]/5 border border-[#D97706]/30">
        <p className="text-sm text-[#D97706]">
          ⚠️ <strong>Hidden test cases</strong> are never exposed to users. They only see pass/fail results during submission.
          <br />
          <strong>Visible test cases</strong> are shown to users during "Run" to help with debugging.
        </p>
      </div>

      {}
      {showNewForm && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-xl bg-[#0F0F0D] border border-[#1A1814] space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[#E8E4D9] uppercase tracking-wide">New Test Case</h3>
            <button
              onClick={() => setShowNewForm(false)}
              className="p-2 hover:bg-[#1A1814] rounded-lg text-[#78716C] hover:text-[#E8E4D9] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div>
            <label className="block text-sm text-[#78716C] mb-1.5 uppercase tracking-wide">Label</label>
            <input
              type="text"
              value={newForm.label}
              onChange={(e) => setNewForm({ ...newForm, label: e.target.value })}
              className="w-full px-3 py-2.5 rounded-lg bg-[#0A0A08] border border-[#1A1814] text-[#E8E4D9] text-sm focus:outline-none focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706]/50 transition-all"
              placeholder="Test Case 1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#78716C] mb-1.5 uppercase tracking-wide">stdin *</label>
              <textarea
                value={newForm.stdin}
                onChange={(e) => setNewForm({ ...newForm, stdin: e.target.value })}
                rows={5}
                className="w-full px-3 py-2.5 rounded-lg bg-[#0A0A08] border border-[#1A1814] text-[#E8E4D9] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706]/50 transition-all"
                placeholder="4&#10;2 7 11 15&#10;9"
              />
            </div>
            <div>
              <label className="block text-sm text-[#78716C] mb-1.5 uppercase tracking-wide">Expected stdout *</label>
              <textarea
                value={newForm.expectedStdout}
                onChange={(e) => setNewForm({ ...newForm, expectedStdout: e.target.value })}
                rows={5}
                className="w-full px-3 py-2.5 rounded-lg bg-[#0A0A08] border border-[#1A1814] text-[#E8E4D9] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706]/50 transition-all"
                placeholder="0 1"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setNewForm({ ...newForm, isHidden: !newForm.isHidden })}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors font-medium ${
                newForm.isHidden
                  ? "bg-red-500/10 text-red-400 border border-red-500/30"
                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
              }`}
            >
              {newForm.isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {newForm.isHidden ? "Hidden" : "Visible"}
            </button>
            <span className="text-sm text-[#78716C]">
              {newForm.isHidden ? "Users won't see the input/output" : "Users can see this test case"}
            </span>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowNewForm(false)}
              className="flex-1 py-2.5 rounded-lg bg-[#1A1814] hover:bg-[#1A1814]/80 text-[#E8E4D9] transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateNew}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-[#D97706] to-amber-600 hover:from-[#D97706]/90 hover:to-amber-600/90 text-white disabled:opacity-50 transition-all font-medium shadow-lg shadow-[#D97706]/20"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Create
            </button>
          </div>
        </motion.div>
      )}

      {}
      {testCases.length === 0 ? (
        <div className="text-center py-16 bg-[#0F0F0D] rounded-xl border border-[#1A1814]">
          <CheckCircle className="h-12 w-12 text-[#78716C] mx-auto mb-4" />
          <p className="text-[#78716C]">No test cases yet</p>
          <button
            onClick={() => setShowNewForm(true)}
            className="inline-flex items-center gap-2 mt-4 text-[#D97706] hover:text-[#D97706]/80 font-medium"
          >
            <Plus className="h-4 w-4" />
            Add your first test case
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {testCases.map((tc, index) => (
            <motion.div
              key={tc.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-4 rounded-xl bg-[#0F0F0D] border border-[#1A1814] hover:border-[#D97706]/30 transition-all"
            >
              {editingId === tc.id ? (
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-[#78716C] mb-1.5 uppercase tracking-wide">Label</label>
                    <input
                      type="text"
                      value={editForm.label}
                      onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg bg-[#0A0A08] border border-[#1A1814] text-[#E8E4D9] text-sm focus:outline-none focus:ring-2 focus:ring-[#D97706]/50"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-[#78716C] mb-1.5 uppercase tracking-wide">stdin</label>
                      <textarea
                        value={editForm.stdin}
                        onChange={(e) => setEditForm({ ...editForm, stdin: e.target.value })}
                        rows={5}
                        className="w-full px-3 py-2.5 rounded-lg bg-[#0A0A08] border border-[#1A1814] text-[#E8E4D9] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#D97706]/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-[#78716C] mb-1.5 uppercase tracking-wide">Expected stdout</label>
                      <textarea
                        value={editForm.expectedStdout}
                        onChange={(e) => setEditForm({ ...editForm, expectedStdout: e.target.value })}
                        rows={5}
                        className="w-full px-3 py-2.5 rounded-lg bg-[#0A0A08] border border-[#1A1814] text-[#E8E4D9] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#D97706]/50"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditForm({ ...editForm, isHidden: !editForm.isHidden })}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors font-medium ${
                        editForm.isHidden
                          ? "bg-red-500/10 text-red-400 border border-red-500/30"
                          : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                      }`}
                    >
                      {editForm.isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      {editForm.isHidden ? "Hidden" : "Visible"}
                    </button>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={cancelEditing}
                      className="flex-1 py-2.5 rounded-lg bg-[#1A1814] hover:bg-[#1A1814]/80 text-[#E8E4D9] transition-colors font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-[#D97706] to-amber-600 hover:from-[#D97706]/90 hover:to-amber-600/90 text-white disabled:opacity-50 transition-all font-medium"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-[#E8E4D9] font-semibold">{tc.label || `Test Case ${index + 1}`}</span>
                      <button
                        onClick={() => handleToggleHidden(tc.id)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors font-medium ${
                          tc.isHidden
                            ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30"
                            : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30"
                        }`}
                      >
                        {tc.isHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        {tc.isHidden ? "Hidden" : "Visible"}
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEditing(tc)}
                        className="p-2 rounded-lg hover:bg-[#1A1814] text-[#78716C] hover:text-[#D97706] transition-colors"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(tc.id)}
                        className="p-2 rounded-lg hover:bg-red-500/10 text-[#78716C] hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-[#78716C] mb-1.5 block uppercase tracking-wide">stdin</label>
                      <pre className="p-3 rounded-lg bg-[#0A0A08] border border-[#1A1814] text-[#E8E4D9] text-sm font-mono whitespace-pre-wrap max-h-32 overflow-auto">
                        {tc.stdin}
                      </pre>
                    </div>
                    <div>
                      <label className="text-xs text-[#78716C] mb-1.5 block uppercase tracking-wide">Expected stdout</label>
                      <pre className="p-3 rounded-lg bg-[#0A0A08] border border-[#1A1814] text-[#E8E4D9] text-sm font-mono whitespace-pre-wrap max-h-32 overflow-auto">
                        {tc.expectedStdout}
                      </pre>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TestCaseManager;
