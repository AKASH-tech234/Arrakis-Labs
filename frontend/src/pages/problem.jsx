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
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A08" }}>
      <AppHeader />

      <main className="pt-14">
        <div className="max-w-4xl mx-auto px-6 lg:px-12 py-12">
          {/* Page Header */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-12"
          >
            <h1
              className="text-[#E8E4D9] text-xl font-medium tracking-[0.15em] uppercase mb-3"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Problem Archive
            </h1>
            <p
              className="text-[#78716C] text-sm tracking-wider"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {stats.solved} of {stats.total} completed
            </p>
          </motion.div>

          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <ProblemFilters
              selectedDifficulty={selectedDifficulty}
              setSelectedDifficulty={setSelectedDifficulty}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              categories={categories}
            />
          </motion.div>

          {/* Problem List */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <ProblemList problems={filteredProblems} />
          </motion.div>
        </div>
      </main>
    </div>
  );
}
