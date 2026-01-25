
import { motion, AnimatePresence } from "framer-motion";

export default function AIFeedbackPanel({
  isVisible,
  onClose,
  loading = false,
  error = null,
  feedback = null,
}) {
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
          {}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1A1814] sticky top-0 bg-[#0A0A08] z-10">
            <span
              className="text-[#E8E4D9] text-xs uppercase tracking-wider"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              AI Analysis
            </span>
            <button
              onClick={onClose}
              className="text-[#3D3D3D] hover:text-[#78716C] transition-colors text-xl leading-none"
            >
              ×
            </button>
          </div>

          {}
          <div className="p-4">
            {}
            {loading && (
              <div className="flex flex-col items-center justify-center py-12">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  className="w-8 h-8 border-2 border-[#D97706] border-t-transparent rounded-full mb-4"
                />
                <p
                  className="text-[#78716C] text-xs uppercase tracking-wider"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  Analyzing your code...
                </p>
                <p
                  className="text-[#3D3D3D] text-[10px] mt-2"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  This may take a few seconds
                </p>
              </div>
            )}

            {}
            {!loading && error && (
              <div className="py-8">
                <div className="border border-[#92400E]/30 bg-[#92400E]/5 p-4 rounded">
                  <h4
                    className="text-[#D97706] text-xs uppercase tracking-wider mb-2"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    Analysis Failed
                  </h4>
                  <p
                    className="text-[#E8E4D9] text-xs leading-relaxed"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    {error}
                  </p>
                </div>
              </div>
            )}

            {}
            {!loading && !error && !feedback && (
              <div className="flex flex-col items-center justify-center py-12">
                <p
                  className="text-[#78716C] text-xs uppercase tracking-wider"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  No feedback available
                </p>
              </div>
            )}

            {}
            {!loading && !error && feedback && (
              <div className="space-y-6">
                {}
                {feedback.feedback && (
                  <FeedbackSection feedback={feedback.feedback} />
                )}

                {}
                {feedback.difficulty && (
                  <DifficultySection difficulty={feedback.difficulty} />
                )}

                {}
                {feedback.learning && (
                  <LearningSection learning={feedback.learning} />
                )}

                {}
                {feedback.report && <ReportSection report={feedback.report} />}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FeedbackSection({ feedback }) {
  return (
    <div className="space-y-4">
      {}
      {feedback.summary && (
        <div>
          <p
            className="text-[#E8E4D9] text-sm leading-relaxed"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {feedback.summary}
          </p>
        </div>
      )}

      {}
      {feedback.error_type && (
        <div className="inline-block px-2 py-1 border border-[#92400E]/30 bg-[#92400E]/10">
          <span
            className="text-[#D97706] text-[10px] uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {feedback.error_type.replace(/_/g, " ")}
          </span>
        </div>
      )}

      {}
      {feedback.hints && feedback.hints.length > 0 && (
        <div className="space-y-3">
          <h4
            className="text-[#78716C] text-[10px] uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Hints
          </h4>
          {feedback.hints.map((hint, index) => (
            <div
              key={index}
              className="border-l-2 border-[#D97706]/40 pl-3 py-1"
            >
              <p
                className="text-[#E8E4D9] text-xs leading-relaxed"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                <span className="text-[#D97706] mr-2">#{index + 1}</span>
                {hint}
              </p>
            </div>
          ))}
        </div>
      )}

      {}
      {feedback.code_suggestion && (
        <div>
          <h4
            className="text-[#78716C] text-[10px] uppercase tracking-wider mb-3"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Suggested Fix
          </h4>
          <pre className="bg-[#0D0D0B] border border-[#1A1814] p-4 overflow-x-auto rounded">
            <code
              className="text-[#E8E4D9] text-xs"
              style={{
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              }}
            >
              {feedback.code_suggestion}
            </code>
          </pre>
        </div>
      )}

      {}
      {feedback.next_steps && feedback.next_steps.length > 0 && (
        <div className="space-y-2">
          <h4
            className="text-[#78716C] text-[10px] uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Next Steps
          </h4>
          <ul className="space-y-1">
            {feedback.next_steps.map((step, index) => (
              <li
                key={index}
                className="text-[#E8E4D9] text-xs leading-relaxed flex items-start gap-2"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                <span className="text-[#78716C]">→</span>
                {step}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DifficultySection({ difficulty }) {
  const getDifficultyColor = (level) => {
    const colors = {
      easy: "#22C55E",
      medium: "#F59E0B",
      hard: "#EF4444",
    };
    return colors[level?.toLowerCase()] || "#78716C";
  };

  return (
    <div className="border-t border-[#1A1814] pt-4 space-y-3">
      <h4
        className="text-[#78716C] text-[10px] uppercase tracking-wider"
        style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
      >
        Difficulty Analysis
      </h4>

      {}
      {difficulty.level && (
        <div className="flex items-center gap-2">
          <span
            className="text-xs uppercase tracking-wider"
            style={{
              fontFamily: "'Rajdhani', system-ui, sans-serif",
              color: getDifficultyColor(difficulty.level),
            }}
          >
            {difficulty.level}
          </span>
        </div>
      )}

      {}
      {difficulty.reasoning && (
        <p
          className="text-[#E8E4D9] text-xs leading-relaxed"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          {difficulty.reasoning}
        </p>
      )}

      {}
      {difficulty.key_concepts && difficulty.key_concepts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {difficulty.key_concepts.map((concept, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-[#1A1814] text-[#E8E4D9] text-[10px] uppercase tracking-wider"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {concept}
            </span>
          ))}
        </div>
      )}

      {}
      {difficulty.prerequisites && difficulty.prerequisites.length > 0 && (
        <div>
          <span
            className="text-[#78716C] text-[10px] uppercase tracking-wider block mb-1"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Prerequisites
          </span>
          <p
            className="text-[#E8E4D9] text-xs"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {difficulty.prerequisites.join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}

function LearningSection({ learning }) {
  return (
    <div className="border-t border-[#1A1814] pt-4 space-y-3">
      <h4
        className="text-[#78716C] text-[10px] uppercase tracking-wider"
        style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
      >
        Learning Insights
      </h4>

      {}
      {learning.strengths && learning.strengths.length > 0 && (
        <div className="space-y-2">
          <span
            className="text-[#22C55E] text-[10px] uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Strengths
          </span>
          <ul className="space-y-1">
            {learning.strengths.map((strength, index) => (
              <li
                key={index}
                className="text-[#E8E4D9] text-xs leading-relaxed flex items-start gap-2"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                <span className="text-[#22C55E]">✓</span>
                {strength}
              </li>
            ))}
          </ul>
        </div>
      )}

      {}
      {learning.weaknesses && learning.weaknesses.length > 0 && (
        <div className="space-y-2">
          <span
            className="text-[#F59E0B] text-[10px] uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Areas to Improve
          </span>
          <ul className="space-y-1">
            {learning.weaknesses.map((weakness, index) => (
              <li
                key={index}
                className="text-[#E8E4D9] text-xs leading-relaxed flex items-start gap-2"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                <span className="text-[#F59E0B]">!</span>
                {weakness}
              </li>
            ))}
          </ul>
        </div>
      )}

      {}
      {learning.recommendations && learning.recommendations.length > 0 && (
        <div className="space-y-2">
          <span
            className="text-[#78716C] text-[10px] uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Recommendations
          </span>
          <ul className="space-y-1">
            {learning.recommendations.map((rec, index) => (
              <li
                key={index}
                className="text-[#E8E4D9] text-xs leading-relaxed flex items-start gap-2"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                <span className="text-[#78716C]">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {}
      {learning.similar_problems && learning.similar_problems.length > 0 && (
        <div className="space-y-2">
          <span
            className="text-[#78716C] text-[10px] uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Similar Problems to Practice
          </span>
          <div className="flex flex-wrap gap-2">
            {learning.similar_problems.map((problem, index) => (
              <span
                key={index}
                className="px-2 py-1 border border-[#1A1814] text-[#E8E4D9] text-[10px]"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                {problem}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReportSection({ report }) {
  return (
    <div className="border-t border-[#1A1814] pt-4 space-y-3">
      <h4
        className="text-[#78716C] text-[10px] uppercase tracking-wider"
        style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
      >
        Session Summary
      </h4>

      {}
      {report.summary && (
        <p
          className="text-[#E8E4D9] text-xs leading-relaxed"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          {report.summary}
        </p>
      )}

      {}
      {report.progress && (
        <div className="flex items-center gap-2">
          <span
            className="text-[#78716C] text-[10px] uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Progress:
          </span>
          <span
            className="text-[#D97706] text-xs"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {report.progress}
          </span>
        </div>
      )}

      {}
      {report.topics_covered && report.topics_covered.length > 0 && (
        <div className="space-y-1">
          <span
            className="text-[#78716C] text-[10px] uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Topics Covered
          </span>
          <div className="flex flex-wrap gap-2">
            {report.topics_covered.map((topic, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-[#1A1814] text-[#E8E4D9] text-[10px]"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}

      {}
      {report.encouragement && (
        <div className="border border-[#22C55E]/20 bg-[#22C55E]/5 p-3 rounded mt-4">
          <p
            className="text-[#22C55E] text-xs italic"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            "{report.encouragement}"
          </p>
        </div>
      )}
    </div>
  );
}
