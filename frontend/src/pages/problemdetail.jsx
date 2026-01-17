// src/pages/problemdetail.jsx - Problem Detail + Code Editor Page
import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import AppHeader from "../components/layout/AppHeader";
import ProblemDescription from "../components/problem/ProblemDescription";
import CodeEditor from "../components/editor/CodeEditor";
import OutputPanel from "../components/editor/OutputPanel";
import AIFeedbackPanel from "../components/feedback/AIFeedbackPanel";

// Mock problem data with full details
const mockProblems = {
  1: {
    id: 1,
    title: "Two Sum",
    difficulty: "Easy",
    category: "Arrays",
    description:
      "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume that each input would have exactly one solution, and you may not use the same element twice. You can return the answer in any order.",
    constraints: [
      "2 <= nums.length <= 10⁴",
      "-10⁹ <= nums[i] <= 10⁹",
      "-10⁹ <= target <= 10⁹",
      "Only one valid answer exists.",
    ],
    examples: [
      {
        input: "nums = [2,7,11,15], target = 9",
        output: "[0,1]",
        explanation: "Because nums[0] + nums[1] == 9, we return [0, 1].",
      },
      {
        input: "nums = [3,2,4], target = 6",
        output: "[1,2]",
      },
      {
        input: "nums = [3,3], target = 6",
        output: "[0,1]",
      },
    ],
  },
  2: {
    id: 2,
    title: "Add Two Numbers",
    difficulty: "Medium",
    category: "Linked List",
    description:
      "You are given two non-empty linked lists representing two non-negative integers. The digits are stored in reverse order, and each of their nodes contains a single digit. Add the two numbers and return the sum as a linked list.",
    constraints: [
      "The number of nodes in each linked list is in the range [1, 100].",
      "0 <= Node.val <= 9",
      "It is guaranteed that the list represents a number that does not have leading zeros.",
    ],
    examples: [
      {
        input: "l1 = [2,4,3], l2 = [5,6,4]",
        output: "[7,0,8]",
        explanation: "342 + 465 = 807.",
      },
    ],
  },
  3: {
    id: 3,
    title: "Longest Substring Without Repeating Characters",
    difficulty: "Medium",
    category: "Strings",
    description:
      "Given a string s, find the length of the longest substring without repeating characters.",
    constraints: [
      "0 <= s.length <= 5 * 10⁴",
      "s consists of English letters, digits, symbols and spaces.",
    ],
    examples: [
      {
        input: 's = "abcabcbb"',
        output: "3",
        explanation: 'The answer is "abc", with the length of 3.',
      },
      {
        input: 's = "bbbbb"',
        output: "1",
        explanation: 'The answer is "b", with the length of 1.',
      },
    ],
  },
};

// Default problem for unknown IDs
const defaultProblem = {
  id: 0,
  title: "Problem Not Found",
  difficulty: "Easy",
  category: "Unknown",
  description: "This problem could not be found in the archive.",
  constraints: [],
  examples: [],
};

export default function ProblemDetail() {
  const { id } = useParams();
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState("idle");
  const [submitted, setSubmitted] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const problem = useMemo(() => {
    return mockProblems[id] || defaultProblem;
  }, [id]);

  const handleRun = (code, language) => {
    setStatus("running");
    setOutput("");

    // Simulate running code
    setTimeout(() => {
      setOutput(
        `Running ${language} code...\n\nTest case 1: Passed\nTest case 2: Passed\n\nAll test cases passed.`
      );
      setStatus("success");
    }, 800);
  };

  const handleSubmit = (code, language) => {
    setStatus("running");
    setOutput("");
    setSubmitted(false);

    // Simulate submission
    setTimeout(() => {
      setOutput(
        `Submitting ${language} solution...\n\nJudging...\n\nAccepted\nRuntime: 45ms (beats 78%)\nMemory: 16.2MB (beats 65%)`
      );
      setStatus("success");
      setSubmitted(true);
    }, 1200);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A08" }}>
      <AppHeader />

      <main className="pt-14 h-screen flex flex-col">
        {/* Breadcrumb */}
        <div className="border-b border-[#1A1814] px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center gap-2">
            <Link
              to="/problems"
              className="text-[#78716C] hover:text-[#E8E4D9] text-xs uppercase tracking-wider transition-colors"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Problems
            </Link>
            <span className="text-[#3D3D3D]">/</span>
            <span
              className="text-[#E8E4D9] text-xs uppercase tracking-wider"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {problem.title}
            </span>
          </div>
        </div>

        {/* Main Content - Split View */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Problem Description */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="w-1/2 border-r border-[#1A1814] overflow-auto"
          >
            <ProblemDescription problem={problem} />
          </motion.div>

          {/* Right Panel - Editor + Output + Feedback */}
          <div className="w-1/2 flex">
            {/* Editor Section */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className={`flex flex-col ${showFeedback ? "w-1/2" : "w-full"}`}
            >
              {/* Code Editor */}
              <div className="flex-1">
                <CodeEditor onRun={handleRun} onSubmit={handleSubmit} />
              </div>

              {/* Output Panel */}
              <OutputPanel output={output} status={status} />

              {/* Get AI Feedback Button */}
              {submitted && !showFeedback && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="border-t border-[#1A1814] px-4 py-3"
                >
                  <button
                    onClick={() => setShowFeedback(true)}
                    className="w-full py-2 border border-[#92400E]/30 text-[#D97706] hover:bg-[#92400E]/10 transition-colors duration-200 text-xs uppercase tracking-wider"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    Get AI Feedback
                  </button>
                </motion.div>
              )}
            </motion.div>

            {/* AI Feedback Panel */}
            {showFeedback && (
              <div className="w-1/2">
                <AIFeedbackPanel
                  isVisible={showFeedback}
                  onClose={() => setShowFeedback(false)}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
