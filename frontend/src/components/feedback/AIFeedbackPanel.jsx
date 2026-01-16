// src/components/feedback/AIFeedbackPanel.jsx
import { motion, AnimatePresence } from "framer-motion";

// Mock AI feedback data
const mockFeedback = {
  summary:
    "Your solution demonstrates understanding of the two-pointer technique, though there are opportunities for optimization.",
  analysis: [
    {
      type: "Approach",
      content:
        "You correctly identified this as a hash map problem. The nested loop approach works but has O(n²) time complexity.",
    },
    {
      type: "Optimization",
      content:
        "Consider using a single-pass hash map solution to achieve O(n) time complexity. Store each element's complement as you iterate.",
    },
    {
      type: "Edge Cases",
      content:
        "Your solution handles empty arrays correctly. Consider adding explicit handling for duplicate values.",
    },
  ],
  suggestion: `# Optimized approach
def two_sum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []`,
};

export default function AIFeedbackPanel({ isVisible, onClose }) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="border-l border-[#1A1814] h-full overflow-auto"
          style={{ backgroundColor: "#0A0A08" }}
        >
          {/* Panel Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1A1814] sticky top-0 bg-[#0A0A08]">
            <span
              className="text-[#E8E4D9] text-xs uppercase tracking-wider"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              AI Analysis
            </span>
            <button
              onClick={onClose}
              className="text-[#3D3D3D] hover:text-[#78716C] transition-colors"
            >
              <span className="text-sm">×</span>
            </button>
          </div>

          {/* Feedback Content */}
          <div className="p-4 space-y-6">
            {/* Summary */}
            <div>
              <p
                className="text-[#E8E4D9] text-sm leading-relaxed"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                {mockFeedback.summary}
              </p>
            </div>

            {/* Analysis Sections */}
            <div className="space-y-4">
              {mockFeedback.analysis.map((item, index) => (
                <div key={index} className="border-l border-[#1A1814] pl-4">
                  <h4
                    className="text-[#78716C] text-[10px] uppercase tracking-wider mb-2"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    {item.type}
                  </h4>
                  <p
                    className="text-[#E8E4D9] text-xs leading-relaxed"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    {item.content}
                  </p>
                </div>
              ))}
            </div>

            {/* Code Suggestion */}
            <div>
              <h4
                className="text-[#78716C] text-[10px] uppercase tracking-wider mb-3"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Suggested Approach
              </h4>
              <pre className="bg-[#0D0D0B] border border-[#1A1814] p-4 overflow-x-auto">
                <code
                  className="text-[#E8E4D9] text-xs font-mono"
                  style={{
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  }}
                >
                  {mockFeedback.suggestion}
                </code>
              </pre>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
