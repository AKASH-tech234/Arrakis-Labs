// src/pages/problem.jsx - Problem Library Page
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import AppHeader from "../components/layout/AppHeader";
import ProblemList from "../components/problem/ProblemList";
import ProblemFilters from "../components/problem/ProblemFilters";
import POTDBanner from "../components/potd/POTDBanner";
import { getPublicQuestions } from "../services/api";

export default function ProblemLibrary() {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setLoadError("");

        const { questions } = await getPublicQuestions({ limit: 1000 });
        const mapped = (questions || []).map((q) => {
          const category = Array.isArray(q.tags) && q.tags.length > 0 ? q.tags[0] : "General";
          return {
            id: q._id,
            title: q.title,
            difficulty: q.difficulty,
            category,
            solved: false,
          };
        });

        if (mounted) setProblems(mapped);
      } catch (e) {
        if (mounted) setLoadError(e?.message || "Failed to load problems");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const categories = useMemo(() => {
    return [...new Set(problems.map((p) => p.category))].sort((a, b) => a.localeCompare(b));
  }, [problems]);

  const filteredProblems = useMemo(() => {
    return problems.filter((problem) => {
      const matchesDifficulty =
        selectedDifficulty === "All" ||
        problem.difficulty === selectedDifficulty;
      const matchesCategory =
        selectedCategory === "All" || problem.category === selectedCategory;
      return matchesDifficulty && matchesCategory;
    });
  }, [problems, selectedDifficulty, selectedCategory]);

  const stats = useMemo(() => {
    const total = problems.length;
    const solved = problems.filter((p) => p.solved).length;
    return { total, solved };
  }, [problems]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A08" }}>
      <AppHeader />

      <main className="pt-14">
        <div className="max-w-5xl mx-auto px-6 lg:px-12 py-12">
          {/* Page Header */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-12"
          >
            <h1
              className="text-[#E8E4D9] text-4xl font-bold tracking-[0.15em] uppercase mb-3"
              style={{ fontFamily: "'Rajdhani', 'Orbitron', system-ui, sans-serif" }}
            >
              Problem Archive
            </h1>
            <p
              className="text-[#A29A8C] text-base tracking-wider"
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

          {/* POTD Banner */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <POTDBanner />
          </motion.div>

          {/* Problem List */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            {loading ? (
              <div className="py-12 text-center">
                <p
                  className="text-[#A29A8C] text-base uppercase tracking-wider"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  Loading problems...
                </p>
              </div>
            ) : loadError ? (
              <div className="py-12 text-center">
                <p
                  className="text-[#F59E0B] text-base uppercase tracking-wider"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  {loadError}
                </p>
              </div>
            ) : (
              <ProblemList problems={filteredProblems} />
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
