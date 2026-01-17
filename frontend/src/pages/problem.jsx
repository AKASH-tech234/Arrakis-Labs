// src/pages/problem.jsx - Problem Library Page
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import AppHeader from "../components/layout/AppHeader";
import ProblemList from "../components/problem/ProblemList";
import ProblemFilters from "../components/problem/ProblemFilters";

// Mock problem data
const mockProblems = [
  {
    id: 1,
    title: "Two Sum",
    difficulty: "Easy",
    category: "Arrays",
    solved: true,
  },
  {
    id: 2,
    title: "Add Two Numbers",
    difficulty: "Medium",
    category: "Linked List",
    solved: true,
  },
  {
    id: 3,
    title: "Longest Substring Without Repeating Characters",
    difficulty: "Medium",
    category: "Strings",
    solved: false,
  },
  {
    id: 4,
    title: "Median of Two Sorted Arrays",
    difficulty: "Hard",
    category: "Arrays",
    solved: false,
  },
  {
    id: 5,
    title: "Longest Palindromic Substring",
    difficulty: "Medium",
    category: "Strings",
    solved: false,
  },
  {
    id: 6,
    title: "Reverse Integer",
    difficulty: "Medium",
    category: "Math",
    solved: true,
  },
  {
    id: 7,
    title: "String to Integer (atoi)",
    difficulty: "Medium",
    category: "Strings",
    solved: false,
  },
  {
    id: 8,
    title: "Palindrome Number",
    difficulty: "Easy",
    category: "Math",
    solved: true,
  },
  {
    id: 9,
    title: "Regular Expression Matching",
    difficulty: "Hard",
    category: "Strings",
    solved: false,
  },
  {
    id: 10,
    title: "Container With Most Water",
    difficulty: "Medium",
    category: "Arrays",
    solved: false,
  },
  {
    id: 11,
    title: "Integer to Roman",
    difficulty: "Medium",
    category: "Math",
    solved: false,
  },
  {
    id: 12,
    title: "Roman to Integer",
    difficulty: "Easy",
    category: "Math",
    solved: true,
  },
  {
    id: 13,
    title: "Longest Common Prefix",
    difficulty: "Easy",
    category: "Strings",
    solved: false,
  },
  {
    id: 14,
    title: "3Sum",
    difficulty: "Medium",
    category: "Arrays",
    solved: false,
  },
  {
    id: 15,
    title: "Valid Parentheses",
    difficulty: "Easy",
    category: "Strings",
    solved: true,
  },
  {
    id: 16,
    title: "Merge Two Sorted Lists",
    difficulty: "Easy",
    category: "Linked List",
    solved: false,
  },
  {
    id: 17,
    title: "Generate Parentheses",
    difficulty: "Medium",
    category: "Recursion",
    solved: false,
  },
  {
    id: 18,
    title: "Merge k Sorted Lists",
    difficulty: "Hard",
    category: "Linked List",
    solved: false,
  },
  {
    id: 19,
    title: "Search in Rotated Sorted Array",
    difficulty: "Medium",
    category: "Binary Search",
    solved: false,
  },
  {
    id: 20,
    title: "Valid Sudoku",
    difficulty: "Medium",
    category: "Arrays",
    solved: false,
  },
  {
    id: 21,
    title: "Longest Increasing Subsequence",
    difficulty: "Medium",
    category: "Dynamic Programming",
    solved: false,
  },
  {
    id: 22,
    title: "Word Break",
    difficulty: "Medium",
    category: "Dynamic Programming",
    solved: false,
  },
  {
    id: 23,
    title: "Coin Change",
    difficulty: "Medium",
    category: "Dynamic Programming",
    solved: false,
  },
  {
    id: 24,
    title: "Edit Distance",
    difficulty: "Hard",
    category: "Dynamic Programming",
    solved: false,
  },
  {
    id: 25,
    title: "House Robber",
    difficulty: "Easy",
    category: "Dynamic Programming",
    solved: false,
  },
];

const categories = [...new Set(mockProblems.map((p) => p.category))];

export default function ProblemLibrary() {
  const [selectedDifficulty, setSelectedDifficulty] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const filteredProblems = useMemo(() => {
    return mockProblems.filter((problem) => {
      const matchesDifficulty =
        selectedDifficulty === "All" ||
        problem.difficulty === selectedDifficulty;
      const matchesCategory =
        selectedCategory === "All" || problem.category === selectedCategory;
      return matchesDifficulty && matchesCategory;
    });
  }, [selectedDifficulty, selectedCategory]);

  const stats = useMemo(() => {
    const total = mockProblems.length;
    const solved = mockProblems.filter((p) => p.solved).length;
    return { total, solved };
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: "#0A0A08" }}>
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Top left glow */}
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-[#D97706]/5 rounded-full blur-3xl"></div>
        {/* Bottom right glow */}
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-[#92400E]/5 rounded-full blur-3xl"></div>
        {/* Center accent */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#D97706]/3 rounded-full blur-3xl"></div>
      </div>

      {/* Grid Pattern Overlay */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 opacity-5"
        style={{
          backgroundImage: `linear-gradient(to right, #D97706 1px, transparent 1px), linear-gradient(to bottom, #D97706 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}
      ></div>

      <AppHeader />

      <main className="pt-20 relative z-10">
        <div className="max-w-6xl mx-auto px-6 lg:px-12 py-12">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16 relative"
          >
            {/* Accent glow */}
            <div className="absolute -left-12 top-0 w-48 h-1 bg-gradient-to-r from-[#D97706] to-transparent blur-lg"></div>
            
            <h1
              className="text-4xl md:text-5xl font-bold text-[#E8E4D9] mb-4 tracking-[0.02em]"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Challenge Archive
            </h1>
            <p
              className="text-[#78716C] text-lg tracking-wider mb-6"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Master the Mentat Trials through algorithmic challenges
            </p>
            
            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4 max-w-md">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="bg-[#1A1814]/50 backdrop-blur-sm border border-[#D97706]/20 rounded-lg p-4 hover:border-[#D97706]/40 transition-colors"
              >
                <p className="text-[#78716C] text-xs uppercase tracking-widest mb-2">Completed</p>
                <p className="text-2xl font-bold text-[#D97706]">{stats.solved}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="bg-[#1A1814]/50 backdrop-blur-sm border border-[#D97706]/20 rounded-lg p-4 hover:border-[#D97706]/40 transition-colors"
              >
                <p className="text-[#78716C] text-xs uppercase tracking-widest mb-2">Total</p>
                <p className="text-2xl font-bold text-[#E8E4D9]">{stats.total}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="bg-[#1A1814]/50 backdrop-blur-sm border border-[#D97706]/20 rounded-lg p-4 hover:border-[#D97706]/40 transition-colors"
              >
                <p className="text-[#78716C] text-xs uppercase tracking-widest mb-2">Progress</p>
                <p className="text-2xl font-bold text-[#F59E0B]">{Math.round((stats.solved / stats.total) * 100)}%</p>
              </motion.div>
            </div>
          </motion.div>

          {/* Progress Bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-12"
          >
            <div className="relative h-2 bg-[#1A1814] rounded-full overflow-hidden border border-[#D97706]/20">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(stats.solved / stats.total) * 100}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-[#D97706] to-[#F59E0B] rounded-full"
              ></motion.div>
            </div>
          </motion.div>

          {/* Filters Section */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mb-12 bg-[#1A1814]/30 backdrop-blur-sm border border-[#D97706]/10 rounded-lg p-6"
          >
            <p className="text-[#78716C] text-xs uppercase tracking-widest mb-4">Filter Challenges</p>
            <ProblemFilters
              selectedDifficulty={selectedDifficulty}
              setSelectedDifficulty={setSelectedDifficulty}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              categories={categories}
            />
          </motion.div>

          {/* Problem List Section */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="bg-[#1A1814]/20 backdrop-blur-sm border border-[#D97706]/10 rounded-lg p-6 overflow-hidden"
          >
            <ProblemList problems={filteredProblems} />
          </motion.div>
        </div>
      </main>
    </div>
  );
}
