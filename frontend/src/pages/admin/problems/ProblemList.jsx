

import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import DataTable from "../../../components/admin/common/DataTable";
import StatusBadge, {
  DifficultyBadge,
} from "../../../components/admin/common/StatusBadge";
import Pagination from "../../../components/admin/common/Pagination";
import ConfirmModal from "../../../components/admin/common/ConfirmModal";

const mockProblems = [
  {
    id: "p001",
    title: "Two Sum",
    slug: "two-sum",
    difficulty: "Easy",
    category: ["Arrays"],
    status: "published",
    submissions: 15420,
    acceptance: 48.2,
    createdAt: "2025-12-01",
  },
  {
    id: "p002",
    title: "Add Two Numbers",
    slug: "add-two-numbers",
    difficulty: "Medium",
    category: ["Linked List"],
    status: "published",
    submissions: 8932,
    acceptance: 35.7,
    createdAt: "2025-12-02",
  },
  {
    id: "p003",
    title: "Longest Substring",
    slug: "longest-substring",
    difficulty: "Medium",
    category: ["Strings", "Sliding Window"],
    status: "published",
    submissions: 12045,
    acceptance: 31.2,
    createdAt: "2025-12-03",
  },
  {
    id: "p004",
    title: "Median of Two Arrays",
    slug: "median-two-arrays",
    difficulty: "Hard",
    category: ["Arrays", "Binary Search"],
    status: "review",
    submissions: 0,
    acceptance: 0,
    createdAt: "2025-12-10",
  },
  {
    id: "p005",
    title: "Valid Parentheses",
    slug: "valid-parentheses",
    difficulty: "Easy",
    category: ["Strings", "Stack"],
    status: "published",
    submissions: 9876,
    acceptance: 42.1,
    createdAt: "2025-12-05",
  },
  {
    id: "p006",
    title: "Merge k Sorted Lists",
    slug: "merge-k-sorted",
    difficulty: "Hard",
    category: ["Linked List", "Heap"],
    status: "draft",
    submissions: 0,
    acceptance: 0,
    createdAt: "2025-12-12",
  },
  {
    id: "p007",
    title: "Binary Tree Inorder",
    slug: "binary-tree-inorder",
    difficulty: "Easy",
    category: ["Trees"],
    status: "draft",
    submissions: 0,
    acceptance: 0,
    createdAt: "2025-12-15",
  },
];

const columns = [
  { key: "title", label: "Title", sortable: true },
  {
    key: "difficulty",
    label: "Difficulty",
    sortable: true,
    render: (value) => <DifficultyBadge difficulty={value} />,
  },
  {
    key: "category",
    label: "Category",
    sortable: false,
    render: (value) => (
      <div className="flex flex-wrap gap-1">
        {value.slice(0, 2).map((cat) => (
          <span
            key={cat}
            className="px-2 py-0.5 bg-[#1A1814] text-[#78716C] text-[10px] uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {cat}
          </span>
        ))}
        {value.length > 2 && (
          <span className="text-[#78716C] text-[10px]">
            +{value.length - 2}
          </span>
        )}
      </div>
    ),
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    render: (value) => <StatusBadge status={value} showDot />,
  },
  {
    key: "submissions",
    label: "Submissions",
    sortable: true,
    render: (value) => (
      <span
        className="text-[#E8E4D9] text-sm"
        style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
      >
        {value.toLocaleString()}
      </span>
    ),
  },
  {
    key: "acceptance",
    label: "Acceptance",
    sortable: true,
    render: (value) => (
      <span
        className="text-[#78716C] text-sm"
        style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
      >
        {value > 0 ? `${value}%` : "—"}
      </span>
    ),
  },
];

export default function ProblemList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteModal, setDeleteModal] = useState({
    open: false,
    problem: null,
  });

  const itemsPerPage = 10;

  const filteredProblems = useMemo(() => {
    return mockProblems.filter((p) => {
      const matchesSearch =
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.slug.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      const matchesDifficulty =
        difficultyFilter === "all" ||
        p.difficulty.toLowerCase() === difficultyFilter;
      return matchesSearch && matchesStatus && matchesDifficulty;
    });
  }, [searchQuery, statusFilter, difficultyFilter]);

  const paginatedProblems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProblems.slice(start, start + itemsPerPage);
  }, [filteredProblems, currentPage]);

  const totalPages = Math.ceil(filteredProblems.length / itemsPerPage);

  const handleRowClick = (problem) => {
    navigate(`/admin/problems/${problem.id}/edit`);
  };

  const handleDelete = () => {
    
    console.log("Deleting problem:", deleteModal.problem?.slug);
    setDeleteModal({ open: false, problem: null });
  };

  const handleBulkDelete = () => {
    console.log("Bulk delete:", selectedIds);
    setSelectedIds([]);
  };

  return (
    <div className="space-y-6">
      {}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-[#E8E4D9] text-xl uppercase tracking-[0.2em]"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Problems
          </h1>
          <p
            className="text-[#78716C] text-xs uppercase tracking-wider mt-1"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {filteredProblems.length} problems found
          </p>
        </div>
        <Link
          to="/admin/problems/new"
          className="px-4 py-2 bg-gradient-to-r from-[#92400E] to-[#D97706] text-[#0A0A08] 
                     hover:from-[#D97706] hover:to-[#F59E0B] transition-all duration-300 
                     text-xs uppercase tracking-[0.15em]"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          + New Problem
        </Link>
      </div>

      {}
      <div
        className="flex flex-wrap items-center gap-4 p-4 border border-[#1A1814]"
        style={{ backgroundColor: "#0D0D0B" }}
      >
        {}
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search problems..."
            className="w-full bg-[#0A0A08] border border-[#1A1814] text-[#E8E4D9] px-4 py-2 text-sm
                       focus:outline-none focus:border-[#78716C] transition-colors
                       placeholder:text-[#3D3D3D]"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          />
        </div>

        {}
        <div className="flex items-center gap-2">
          <span
            className="text-[#3D3D3D] text-[10px] uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Status
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#0A0A08] border border-[#1A1814] text-[#E8E4D9] px-3 py-2 text-xs uppercase tracking-wider
                       focus:outline-none focus:border-[#78716C] transition-colors appearance-none cursor-pointer"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="review">Review</option>
            <option value="published">Published</option>
            <option value="hidden">Hidden</option>
          </select>
        </div>

        {}
        <div className="flex items-center gap-2">
          <span
            className="text-[#3D3D3D] text-[10px] uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Difficulty
          </span>
          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="bg-[#0A0A08] border border-[#1A1814] text-[#E8E4D9] px-3 py-2 text-xs uppercase tracking-wider
                       focus:outline-none focus:border-[#78716C] transition-colors appearance-none cursor-pointer"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            <option value="all">All</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>

      {}
      {selectedIds.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between p-4 border border-[#F59E0B]/30 bg-[#F59E0B]/5"
        >
          <span
            className="text-[#E8E4D9] text-xs uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {selectedIds.length} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 border border-[#1A1814] text-[#78716C] hover:text-[#E8E4D9] 
                         hover:border-[#78716C] transition-colors text-xs uppercase tracking-wider"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Clear
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-3 py-1.5 border border-red-900/50 text-red-400 hover:bg-red-900/20 
                         transition-colors text-xs uppercase tracking-wider"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Delete Selected
            </button>
          </div>
        </motion.div>
      )}

      {}
      <DataTable
        columns={columns}
        data={paginatedProblems}
        onRowClick={handleRowClick}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        emptyMessage="No problems match your filters"
      />

      {}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredProblems.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      )}

      {}
      <ConfirmModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, problem: null })}
        onConfirm={handleDelete}
        title="Delete Problem"
        message={`Are you sure you want to delete "${deleteModal.problem?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        requireTyping
        typingPhrase={deleteModal.problem?.slug || ""}
      />
    </div>
  );
}
