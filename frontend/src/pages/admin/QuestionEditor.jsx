import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  getQuestionById,
  createQuestion,
  updateQuestion,
} from "../../services/admin/adminApi";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Loader2,
  AlertTriangle,
  Bot,
  FileText,
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
    // AI Metadata fields
    topic: "",
    expectedApproach: "",
    canonicalAlgorithms: [],
    timeComplexityHint: "",
    spaceComplexityHint: "",
    commonMistakes: [],
  });

  const [algorithmInput, setAlgorithmInput] = useState("");
  const [mistakeInput, setMistakeInput] = useState("");

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
              examples:
                q.examples?.length > 0
                  ? q.examples
                  : [{ input: "", output: "", explanation: "" }],
              // AI Metadata fields
              topic: q.topic || "",
              expectedApproach: q.expectedApproach || "",
              canonicalAlgorithms: q.canonicalAlgorithms || [],
              timeComplexityHint: q.timeComplexityHint || "",
              spaceComplexityHint: q.spaceComplexityHint || "",
              commonMistakes: q.commonMistakes || [],
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
      const cleanedData = {
        ...formData,
        examples: formData.examples.filter(
          (ex) => ex.input.trim() || ex.output.trim(),
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

  const handleAddAlgorithm = (e) => {
    if (e.key === "Enter" && algorithmInput.trim()) {
      e.preventDefault();
      if (!formData.canonicalAlgorithms.includes(algorithmInput.trim())) {
        setFormData((prev) => ({
          ...prev,
          canonicalAlgorithms: [
            ...prev.canonicalAlgorithms,
            algorithmInput.trim(),
          ],
        }));
      }
      setAlgorithmInput("");
    }
  };

  const removeAlgorithm = (algo) => {
    setFormData((prev) => ({
      ...prev,
      canonicalAlgorithms: prev.canonicalAlgorithms.filter((a) => a !== algo),
    }));
  };

  const handleAddMistake = (e) => {
    if (e.key === "Enter" && mistakeInput.trim()) {
      e.preventDefault();
      if (!formData.commonMistakes.includes(mistakeInput.trim())) {
        setFormData((prev) => ({
          ...prev,
          commonMistakes: [...prev.commonMistakes, mistakeInput.trim()],
        }));
      }
      setMistakeInput("");
    }
  };

  const removeMistake = (mistake) => {
    setFormData((prev) => ({
      ...prev,
      commonMistakes: prev.commonMistakes.filter((m) => m !== mistake),
    }));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="p-4 rounded-xl bg-[#0F0F0D] border border-[#1A1814]">
          <Loader2 className="h-8 w-8 animate-spin text-[#D97706]" />
        </div>
        <p className="text-[#78716C] mt-4 text-sm uppercase tracking-wider" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
          Loading question...
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
          to="/admin/questions"
          className="p-2.5 rounded-lg border border-[#1A1814] bg-[#0F0F0D] hover:border-[#D97706]/40 text-[#78716C] hover:text-[#D97706] transition-all"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-6 bg-gradient-to-b from-[#D97706] to-transparent rounded-full" />
            <h1 className="text-2xl font-bold text-[#E8E4D9] tracking-wide">
              {isEditing ? "Edit Question" : "New Question"}
            </h1>
          </div>
          <p className="text-[#78716C] text-sm uppercase tracking-widest ml-3">
            {isEditing ? "Update question details" : "Create a new problem"}
          </p>
        </div>
      </motion.div>

      {/* Error Alert */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 flex items-center gap-3"
        >
          <div className="p-2 rounded-lg bg-red-500/10">
            <AlertTriangle className="h-4 w-4 text-red-400" />
          </div>
          <span className="text-red-400 text-sm">{error}</span>
        </motion.div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <label className="block text-xs font-medium text-[#78716C] uppercase tracking-widest mb-2">
            Title *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => handleChange("title", e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-[#1A1814] bg-[#0F0F0D] text-[#E8E4D9] placeholder-[#78716C] focus:outline-none focus:border-[#D97706]/50 focus:ring-2 focus:ring-[#D97706]/20 transition-all"
            placeholder="Two Sum"
          />
        </motion.div>

        {/* Difficulty */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <label className="block text-xs font-medium text-[#78716C] uppercase tracking-widest mb-2">
            Difficulty *
          </label>
          <div className="flex gap-3">
            {["Easy", "Medium", "Hard"].map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => handleChange("difficulty", level)}
                className={`flex-1 py-3 rounded-xl font-medium transition-all border-2 ${
                  formData.difficulty === level
                    ? level === "Easy"
                      ? "bg-[#78716C]/10 text-[#78716C] border-[#78716C]"
                      : level === "Medium"
                        ? "bg-[#D97706]/10 text-[#D97706] border-[#D97706]"
                        : "bg-[#92400E]/10 text-[#92400E] border-[#92400E]"
                    : "bg-[#0F0F0D] text-[#78716C] border-[#1A1814] hover:border-[#78716C]/50"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Description */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <label className="block text-xs font-medium text-[#78716C] uppercase tracking-widest mb-2">
            Description *
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleChange("description", e.target.value)}
            rows={8}
            className="w-full px-4 py-3 rounded-xl border border-[#1A1814] bg-[#0F0F0D] text-[#E8E4D9] placeholder-[#78716C] focus:outline-none focus:border-[#D97706]/50 focus:ring-2 focus:ring-[#D97706]/20 transition-all font-mono text-sm resize-none"
            placeholder="Given an array of integers nums and an integer target..."
          />
        </motion.div>

        {/* Constraints */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        >
          <label className="block text-xs font-medium text-[#78716C] uppercase tracking-widest mb-2">
            Constraints
          </label>
          <textarea
            value={formData.constraints}
            onChange={(e) => handleChange("constraints", e.target.value)}
            rows={4}
            className="w-full px-4 py-3 rounded-xl border border-[#1A1814] bg-[#0F0F0D] text-[#E8E4D9] placeholder-[#78716C] focus:outline-none focus:border-[#D97706]/50 focus:ring-2 focus:ring-[#D97706]/20 transition-all font-mono text-sm resize-none"
            placeholder="2 <= nums.length <= 10^4&#10;-10^9 <= nums[i] <= 10^9"
          />
        </motion.div>

        {/* Tags */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <label className="block text-xs font-medium text-[#78716C] uppercase tracking-widest mb-2">
            Tags
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {formData.tags.map((tag, index) => (
              <span
                key={index}
                className="px-3 py-1.5 rounded-lg bg-[#D97706]/10 text-[#D97706] text-sm flex items-center gap-2 border border-[#D97706]/20"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="hover:text-[#F59E0B] transition-colors"
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
            className="w-full px-4 py-3 rounded-xl border border-[#1A1814] bg-[#0F0F0D] text-[#E8E4D9] placeholder-[#78716C] focus:outline-none focus:border-[#D97706]/50 focus:ring-2 focus:ring-[#D97706]/20 transition-all"
            placeholder="Press Enter to add tags..."
          />
        </motion.div>

        {/* AI Metadata Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="rounded-xl border border-[#1A1814] bg-[#0A0A08] overflow-hidden"
        >
          <div className="p-4 border-b border-[#1A1814] bg-[#0F0F0D]/50 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#D97706]/10">
              <Bot className="h-5 w-5 text-[#D97706]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#E8E4D9] uppercase tracking-wider">
                AI Metadata
              </h3>
              <p className="text-xs text-[#78716C]">For intelligent feedback</p>
            </div>
          </div>
          
          <div className="p-5 space-y-5">
            {/* Topic */}
            <div>
              <label className="block text-xs font-medium text-[#78716C] uppercase tracking-widest mb-2">
                Topic
              </label>
              <select
                value={formData.topic}
                onChange={(e) => handleChange("topic", e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[#1A1814] bg-[#0F0F0D] text-[#E8E4D9] focus:outline-none focus:border-[#D97706]/50 focus:ring-2 focus:ring-[#D97706]/20 transition-all"
              >
                <option value="">Select a topic...</option>
                <option value="Arrays">Arrays</option>
                <option value="Strings">Strings</option>
                <option value="Linked Lists">Linked Lists</option>
                <option value="Trees">Trees</option>
                <option value="Graphs">Graphs</option>
                <option value="Dynamic Programming">Dynamic Programming</option>
                <option value="Recursion">Recursion</option>
                <option value="Sorting">Sorting</option>
                <option value="Binary Search">Binary Search</option>
                <option value="Hash Tables">Hash Tables</option>
                <option value="Stacks">Stacks</option>
                <option value="Queues">Queues</option>
                <option value="Heaps">Heaps</option>
                <option value="Two Pointers">Two Pointers</option>
                <option value="Sliding Window">Sliding Window</option>
                <option value="Greedy">Greedy</option>
                <option value="Backtracking">Backtracking</option>
                <option value="Bit Manipulation">Bit Manipulation</option>
                <option value="Math">Math</option>
                <option value="Design">Design</option>
              </select>
            </div>

            {/* Expected Approach */}
            <div>
              <label className="block text-xs font-medium text-[#78716C] uppercase tracking-widest mb-2">
                Expected Approach
              </label>
              <textarea
                value={formData.expectedApproach}
                onChange={(e) => handleChange("expectedApproach", e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-[#1A1814] bg-[#0F0F0D] text-[#E8E4D9] placeholder-[#78716C] focus:outline-none focus:border-[#D97706]/50 focus:ring-2 focus:ring-[#D97706]/20 transition-all text-sm resize-none"
                placeholder="Describe the optimal approach (e.g., Use hash map to store complements for O(n) lookup...)"
              />
            </div>

            {/* Canonical Algorithms */}
            <div>
              <label className="block text-xs font-medium text-[#78716C] uppercase tracking-widest mb-2">
                Canonical Algorithms
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {formData.canonicalAlgorithms.map((algo, index) => (
                  <span
                    key={index}
                    className="px-3 py-1.5 rounded-lg bg-[#0F0F0D] text-[#E8E4D9] text-sm flex items-center gap-2 border border-[#1A1814]"
                  >
                    {algo}
                    <button
                      type="button"
                      onClick={() => removeAlgorithm(algo)}
                      className="hover:text-[#D97706] transition-colors"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                value={algorithmInput}
                onChange={(e) => setAlgorithmInput(e.target.value)}
                onKeyDown={handleAddAlgorithm}
                className="w-full px-4 py-3 rounded-xl border border-[#1A1814] bg-[#0F0F0D] text-[#E8E4D9] placeholder-[#78716C] focus:outline-none focus:border-[#D97706]/50 focus:ring-2 focus:ring-[#D97706]/20 transition-all"
                placeholder="e.g., hash_map, binary_search, dfs (Press Enter to add)"
              />
            </div>

            {/* Complexity Hints - Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#78716C] uppercase tracking-widest mb-2">
                  Time Complexity Hint
                </label>
                <input
                  type="text"
                  value={formData.timeComplexityHint}
                  onChange={(e) =>
                    handleChange("timeComplexityHint", e.target.value)
                  }
                  className="w-full px-4 py-3 rounded-xl border border-[#1A1814] bg-[#0F0F0D] text-[#E8E4D9] placeholder-[#78716C] focus:outline-none focus:border-[#D97706]/50 focus:ring-2 focus:ring-[#D97706]/20 transition-all"
                  placeholder="O(n), O(log n), O(n²)"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#78716C] uppercase tracking-widest mb-2">
                  Space Complexity Hint
                </label>
                <input
                  type="text"
                  value={formData.spaceComplexityHint}
                  onChange={(e) =>
                    handleChange("spaceComplexityHint", e.target.value)
                  }
                  className="w-full px-4 py-3 rounded-xl border border-[#1A1814] bg-[#0F0F0D] text-[#E8E4D9] placeholder-[#78716C] focus:outline-none focus:border-[#D97706]/50 focus:ring-2 focus:ring-[#D97706]/20 transition-all"
                  placeholder="O(1), O(n)"
                />
              </div>
            </div>

            {/* Common Mistakes */}
            <div>
              <label className="block text-xs font-medium text-[#78716C] uppercase tracking-widest mb-2">
                Common Mistakes
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {formData.commonMistakes.map((mistake, index) => (
                  <span
                    key={index}
                    className="px-3 py-1.5 rounded-lg bg-[#92400E]/10 text-[#92400E] text-sm flex items-center gap-2 border border-[#92400E]/20"
                  >
                    {mistake}
                    <button
                      type="button"
                      onClick={() => removeMistake(mistake)}
                      className="hover:text-red-400 transition-colors"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                value={mistakeInput}
                onChange={(e) => setMistakeInput(e.target.value)}
                onKeyDown={handleAddMistake}
                className="w-full px-4 py-3 rounded-xl border border-[#1A1814] bg-[#0F0F0D] text-[#E8E4D9] placeholder-[#78716C] focus:outline-none focus:border-[#D97706]/50 focus:ring-2 focus:ring-[#D97706]/20 transition-all"
                placeholder="e.g., Off-by-one errors, Not handling edge cases (Press Enter to add)"
              />
            </div>
          </div>
        </motion.div>

        {/* Examples Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="rounded-xl border border-[#1A1814] bg-[#0A0A08] overflow-hidden"
        >
          <div className="p-4 border-b border-[#1A1814] bg-[#0F0F0D]/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#D97706]/10">
                <FileText className="h-5 w-5 text-[#D97706]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#E8E4D9] uppercase tracking-wider">
                  Examples
                </h3>
                <p className="text-xs text-[#78716C]">Visible to users</p>
              </div>
            </div>
            <button
              type="button"
              onClick={addExample}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D97706]/10 text-[#D97706] text-sm font-medium hover:bg-[#D97706]/20 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Example
            </button>
          </div>
          
          <div className="p-5 space-y-4">
            {formData.examples.map((example, index) => (
              <div
                key={index}
                className="p-4 rounded-xl bg-[#0F0F0D] border border-[#1A1814] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#78716C] uppercase tracking-wider">
                    Example {index + 1}
                  </span>
                  {formData.examples.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeExample(index)}
                      className="p-1.5 hover:bg-red-500/10 text-[#78716C] hover:text-red-400 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#78716C] uppercase tracking-wider mb-1.5 block">
                      Input
                    </label>
                    <input
                      type="text"
                      value={example.input}
                      onChange={(e) =>
                        handleExampleChange(index, "input", e.target.value)
                      }
                      className="w-full px-3 py-2 rounded-lg border border-[#1A1814] bg-[#0A0A08] text-[#E8E4D9] text-sm font-mono placeholder-[#78716C] focus:outline-none focus:border-[#D97706]/50 transition-all"
                      placeholder="nums = [2,7,11,15], target = 9"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#78716C] uppercase tracking-wider mb-1.5 block">
                      Output
                    </label>
                    <input
                      type="text"
                      value={example.output}
                      onChange={(e) =>
                        handleExampleChange(index, "output", e.target.value)
                      }
                      className="w-full px-3 py-2 rounded-lg border border-[#1A1814] bg-[#0A0A08] text-[#E8E4D9] text-sm font-mono placeholder-[#78716C] focus:outline-none focus:border-[#D97706]/50 transition-all"
                      placeholder="[0, 1]"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#78716C] uppercase tracking-wider mb-1.5 block">
                    Explanation (optional)
                  </label>
                  <input
                    type="text"
                    value={example.explanation}
                    onChange={(e) =>
                      handleExampleChange(index, "explanation", e.target.value)
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#1A1814] bg-[#0A0A08] text-[#E8E4D9] text-sm placeholder-[#78716C] focus:outline-none focus:border-[#D97706]/50 transition-all"
                    placeholder="Because nums[0] + nums[1] == 9, we return [0, 1]."
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.45 }}
          className="flex gap-4 pt-4"
        >
          <Link
            to="/admin/questions"
            className="flex-1 py-3.5 rounded-xl border border-[#1A1814] bg-[#0F0F0D] hover:border-[#78716C]/50 text-[#78716C] hover:text-[#E8E4D9] font-semibold text-center transition-all uppercase tracking-wider text-sm"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-[#D97706] to-[#F59E0B] hover:from-[#B45309] hover:to-[#D97706] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all uppercase tracking-wider text-sm"
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
        </motion.div>
      </form>

      {/* Test Cases Link */}
      {isEditing && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="p-4 rounded-xl border border-[#D97706]/20 bg-[#D97706]/5"
        >
          <p className="text-sm text-[#D97706]">
            💡 To manage test cases for this question, visit the{" "}
            <Link
              to={`/admin/questions/${id}/test-cases`}
              className="underline hover:text-[#F59E0B] transition-colors"
            >
              Test Cases Manager
            </Link>
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default QuestionEditor;
