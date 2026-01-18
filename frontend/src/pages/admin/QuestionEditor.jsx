import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  getQuestionById,
  createQuestion,
  updateQuestion,
} from "../../services/adminApi";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Loader2,
  AlertTriangle,
} from "lucide-react";

const QuestionEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id && id !== "new";

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    difficulty: "Medium",
    constraints: "",
    tags: [],
    examples: [{ input: "", output: "", explanation: "" }],
  });

  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    if (isEditing) {
      const fetchQuestion = async () => {
        try {
          const response = await getQuestionById(id);
          if (response.success) {
            const q = response.data;
            setFormData({
              title: q.title || "",
              description: q.description || "",
              difficulty: q.difficulty || "Medium",
              constraints: q.constraints || "",
              tags: q.tags || [],
              examples: q.examples?.length > 0 ? q.examples : [{ input: "", output: "", explanation: "" }],
            });
          }
        } catch (err) {
          setError(err.response?.data?.message || "Failed to load question");
        } finally {
          setLoading(false);
        }
      };

      fetchQuestion();
    }
  }, [id, isEditing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    // Validation
    if (!formData.title.trim()) {
      setError("Title is required");
      setSaving(false);
      return;
    }

    if (!formData.description.trim()) {
      setError("Description is required");
      setSaving(false);
      return;
    }

    try {
      // Filter out empty examples
      const cleanedData = {
        ...formData,
        examples: formData.examples.filter(
          (ex) => ex.input.trim() || ex.output.trim()
        ),
      };

      if (isEditing) {
        await updateQuestion(id, cleanedData);
      } else {
        await createQuestion(cleanedData);
      }

      navigate("/admin/questions");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save question");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleExampleChange = (index, field, value) => {
    const newExamples = [...formData.examples];
    newExamples[index] = { ...newExamples[index], [field]: value };
    setFormData((prev) => ({ ...prev, examples: newExamples }));
  };

  const addExample = () => {
    setFormData((prev) => ({
      ...prev,
      examples: [...prev.examples, { input: "", output: "", explanation: "" }],
    }));
  };

  const removeExample = (index) => {
    if (formData.examples.length > 1) {
      setFormData((prev) => ({
        ...prev,
        examples: prev.examples.filter((_, i) => i !== index),
      }));
    }
  };

  const handleAddTag = (e) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      if (!formData.tags.includes(tagInput.trim())) {
        setFormData((prev) => ({
          ...prev,
          tags: [...prev.tags, tagInput.trim()],
        }));
      }
      setTagInput("");
    }
  };

  const removeTag = (tag) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/admin/questions"
          className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-white">
          {isEditing ? "Edit Question" : "New Question"}
        </h1>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <span className="text-red-400">{error}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Title *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => handleChange("title", e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-gray-800/50 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="Two Sum"
          />
        </div>

        {/* Difficulty */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Difficulty *
          </label>
          <div className="flex gap-3">
            {["Easy", "Medium", "Hard"].map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => handleChange("difficulty", level)}
                className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                  formData.difficulty === level
                    ? level === "Easy"
                      ? "bg-green-500/20 text-green-400 border-2 border-green-500"
                      : level === "Medium"
                      ? "bg-yellow-500/20 text-yellow-400 border-2 border-yellow-500"
                      : "bg-red-500/20 text-red-400 border-2 border-red-500"
                    : "bg-gray-800/50 text-gray-400 border border-gray-700 hover:border-gray-600"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Description *
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleChange("description", e.target.value)}
            rows={8}
            className="w-full px-4 py-3 rounded-lg bg-gray-800/50 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono text-sm"
            placeholder="Given an array of integers nums and an integer target..."
          />
        </div>

        {/* Constraints */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Constraints
          </label>
          <textarea
            value={formData.constraints}
            onChange={(e) => handleChange("constraints", e.target.value)}
            rows={4}
            className="w-full px-4 py-3 rounded-lg bg-gray-800/50 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono text-sm"
            placeholder="2 <= nums.length <= 10^4&#10;-10^9 <= nums[i] <= 10^9"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Tags
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {formData.tags.map((tag, index) => (
              <span
                key={index}
                className="px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 text-sm flex items-center gap-2"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="hover:text-orange-300"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleAddTag}
            className="w-full px-4 py-3 rounded-lg bg-gray-800/50 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="Press Enter to add tags..."
          />
        </div>

        {/* Examples */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-300">
              Examples (visible to users)
            </label>
            <button
              type="button"
              onClick={addExample}
              className="flex items-center gap-1 text-sm text-orange-400 hover:text-orange-300"
            >
              <Plus className="h-4 w-4" />
              Add Example
            </button>
          </div>
          <div className="space-y-4">
            {formData.examples.map((example, index) => (
              <div
                key={index}
                className="p-4 rounded-lg bg-gray-800/50 border border-gray-700 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Example {index + 1}</span>
                  {formData.examples.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeExample(index)}
                      className="p-1 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Input</label>
                    <input
                      type="text"
                      value={example.input}
                      onChange={(e) => handleExampleChange(index, "input", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-gray-900/50 border border-gray-600 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="nums = [2,7,11,15], target = 9"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Output</label>
                    <input
                      type="text"
                      value={example.output}
                      onChange={(e) => handleExampleChange(index, "output", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-gray-900/50 border border-gray-600 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="[0, 1]"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Explanation (optional)</label>
                  <input
                    type="text"
                    value={example.explanation}
                    onChange={(e) => handleExampleChange(index, "explanation", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-gray-900/50 border border-gray-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Because nums[0] + nums[1] == 9, we return [0, 1]."
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-4 pt-4">
          <Link
            to="/admin/questions"
            className="flex-1 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium text-center transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-5 w-5" />
                {isEditing ? "Update Question" : "Create Question"}
              </>
            )}
          </button>
        </div>
      </form>

      {/* Test Cases Note */}
      {isEditing && (
        <div className="mt-8 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <p className="text-sm text-blue-400">
            💡 To manage test cases for this question, visit the{" "}
            <Link
              to={`/admin/questions/${id}/test-cases`}
              className="underline hover:text-blue-300"
            >
              Test Cases Manager
            </Link>
          </p>
        </div>
      )}
    </div>
  );
};

export default QuestionEditor;
