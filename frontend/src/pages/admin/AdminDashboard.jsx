import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { getDashboardStats } from "../../services/admin/adminApi";
import {
  LayoutDashboard,
  FileText,
  Upload,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  AlertTriangle,
  Loader2,
  Trophy,
  Flame,
} from "lucide-react";

// Skeleton loader component for consistent loading states
const SkeletonCard = ({ accent = false }) => (
  <div className={`rounded-xl border ${accent ? 'border-[#D97706]/30 bg-[#D97706]/5' : 'border-[#1A1814] bg-[#0F0F0D]'} p-5`}>
    <div className="flex items-center justify-between">
      <div className="space-y-2 flex-1">
        <div className="h-3 w-24 bg-[#1A1814] rounded animate-pulse"></div>
        <div className="h-8 w-16 bg-[#1A1814] rounded animate-pulse"></div>
      </div>
      <div className={`p-3 rounded-lg ${accent ? 'bg-[#D97706]/10' : 'bg-[#1A1814]'} animate-pulse`}>
        <div className="h-5 w-5"></div>
      </div>
    </div>
  </div>
);

const SkeletonAnalytics = () => (
  <div className="rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-6">
    <div className="flex items-center gap-2 mb-5">
      <div className="w-1 h-4 bg-[#1A1814] rounded-full animate-pulse"></div>
      <div className="h-3 w-40 bg-[#1A1814] rounded animate-pulse"></div>
    </div>
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center justify-between">
          <div className="h-4 w-16 bg-[#1A1814] rounded animate-pulse"></div>
          <div className="flex items-center gap-4">
            <div className="w-32 h-1.5 bg-[#1A1814] rounded-full animate-pulse"></div>
            <div className="h-4 w-8 bg-[#1A1814] rounded animate-pulse"></div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const AdminDashboard = () => {
  const { admin } = useAdminAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await getDashboardStats();
        if (response.success) {
          setStats(response.data);
        }
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Error state
  if (error) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-6 bg-gradient-to-b from-[#D97706] to-transparent rounded-full"></div>
          <h1 
            className="text-2xl font-bold text-[#E8E4D9] tracking-wide"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Dashboard
          </h1>
        </div>
        <div className="p-5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <span style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>{error}</span>
        </div>
      </div>
    );
  }

  // Prepare stat cards data
  const statCards = [
    {
      title: "Total Questions",
      value: stats?.questions?.total ?? 0,
      icon: FileText,
      accent: true,
      link: "/admin/questions",
    },
    {
      title: "Total Test Cases",
      value: stats?.testCases?.total ?? 0,
      icon: CheckCircle,
      subtext: `${stats?.testCases?.hidden ?? 0} hidden`,
    },
    {
      title: "Total Submissions",
      value: stats?.submissions?.total ?? 0,
      icon: TrendingUp,
    },
    {
      title: "Total Users",
      value: stats?.users ?? 0,
      icon: Users,
    },
  ];

  // Calculate total questions for progress bars
  const totalQuestions = stats?.questions?.total || 1; // Prevent division by zero

  const difficultyBreakdown = [
    { label: "Easy", count: stats?.questions?.byDifficulty?.Easy ?? 0, color: "text-[#78716C]", bg: "bg-[#78716C]" },
    { label: "Medium", count: stats?.questions?.byDifficulty?.Medium ?? 0, color: "text-[#D97706]", bg: "bg-[#D97706]" },
    { label: "Hard", count: stats?.questions?.byDifficulty?.Hard ?? 0, color: "text-[#92400E]", bg: "bg-[#92400E]" },
  ];

  const submissionBreakdown = [
    { label: "Accepted", count: stats?.submissions?.byStatus?.accepted ?? 0, icon: CheckCircle, color: "text-green-400" },
    { label: "Wrong Answer", count: stats?.submissions?.byStatus?.wrong_answer ?? 0, icon: XCircle, color: "text-red-400" },
    { label: "TLE", count: stats?.submissions?.byStatus?.time_limit_exceeded ?? 0, icon: Clock, color: "text-[#D97706]" },
  ];

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-6 bg-gradient-to-b from-[#D97706] to-transparent rounded-full"></div>
          <h1 
            className="text-2xl font-bold text-[#E8E4D9] tracking-wide"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Dashboard
          </h1>
        </div>
        <p 
          className="text-[#78716C] text-sm uppercase tracking-widest ml-3"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          Welcome back, {admin?.email || "Admin"}
        </p>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <Link
          to="/admin/upload"
          className="group relative overflow-hidden rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-5 hover:border-[#D97706]/50 transition-all duration-300 hover:shadow-lg hover:shadow-[#D97706]/10"
        >
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#D97706] via-[#F59E0B] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-[#D97706]/10 group-hover:bg-[#D97706]/20 transition-colors">
              <Upload className="h-5 w-5 text-[#D97706]" />
            </div>
            <div>
              <h3 
                className="font-semibold text-[#E8E4D9] group-hover:text-[#F59E0B] transition-colors"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Upload CSV
              </h3>
              <p 
                className="text-xs text-[#78716C] uppercase tracking-wider mt-0.5"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Bulk import questions
              </p>
            </div>
          </div>
        </Link>

        <Link
          to="/admin/questions/new"
          className="group relative overflow-hidden rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-5 hover:border-[#D97706]/50 transition-all duration-300 hover:shadow-lg hover:shadow-[#D97706]/10"
        >
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#D97706] via-[#F59E0B] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-[#D97706]/10 group-hover:bg-[#D97706]/20 transition-colors">
              <FileText className="h-5 w-5 text-[#D97706]" />
            </div>
            <div>
              <h3 
                className="font-semibold text-[#E8E4D9] group-hover:text-[#F59E0B] transition-colors"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                New Question
              </h3>
              <p 
                className="text-xs text-[#78716C] uppercase tracking-wider mt-0.5"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Create manually
              </p>
            </div>
          </div>
        </Link>

        <Link
          to="/admin/questions"
          className="group relative overflow-hidden rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-5 hover:border-[#D97706]/50 transition-all duration-300 hover:shadow-lg hover:shadow-[#D97706]/10"
        >
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#D97706] via-[#F59E0B] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-[#D97706]/10 group-hover:bg-[#D97706]/20 transition-colors">
              <LayoutDashboard className="h-5 w-5 text-[#D97706]" />
            </div>
            <div>
              <h3 
                className="font-semibold text-[#E8E4D9] group-hover:text-[#F59E0B] transition-colors"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Manage Questions
              </h3>
              <p 
                className="text-xs text-[#78716C] uppercase tracking-wider mt-0.5"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Edit & view all
              </p>
            </div>
          </div>
        </Link>
      </motion.div>

      {/* Stats Overview Section Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="flex items-center gap-2"
      >
        <div className="w-1 h-5 bg-gradient-to-b from-[#D97706] to-transparent rounded-full"></div>
        <h2 
          className="text-[#E8E4D9] text-xs font-medium uppercase tracking-widest"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          Performance Overview
        </h2>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {loading ? (
          <>
            <SkeletonCard accent />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          statCards.map((stat, index) => (
            <div
              key={index}
              className={`rounded-xl border ${stat.accent ? 'border-[#D97706]/30 bg-[#D97706]/5' : 'border-[#1A1814] bg-[#0F0F0D]'} p-5 hover:border-[#D97706]/40 transition-colors min-h-[120px]`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p 
                    className="text-[10px] uppercase tracking-widest text-[#78716C] mb-1.5"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    {stat.title}
                  </p>
                  <p 
                    className="text-3xl font-bold text-[#E8E4D9]"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    {stat.value.toLocaleString()}
                  </p>
                  {stat.subtext && (
                    <p 
                      className="text-[10px] text-[#78716C] mt-1.5 uppercase tracking-wider"
                      style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                    >
                      {stat.subtext}
                    </p>
                  )}
                </div>
                <div className={`p-3 rounded-lg ${stat.accent ? 'bg-[#D97706]/10' : 'bg-[#1A1814]'}`}>
                  <stat.icon className={`h-5 w-5 ${stat.accent ? 'text-[#D97706]' : 'text-[#78716C]'}`} />
                </div>
              </div>
              {stat.link && (
                <Link
                  to={stat.link}
                  className="mt-4 text-xs text-[#D97706] hover:text-[#F59E0B] inline-flex items-center gap-1 uppercase tracking-wider transition-colors"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  View all 
                  <span className="text-sm">→</span>
                </Link>
              )}
            </div>
          ))
        )}
      </motion.div>

      {/* Analytics Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {loading ? (
          <>
            <SkeletonAnalytics />
            <SkeletonAnalytics />
          </>
        ) : (
          <>
            {/* Questions by Difficulty */}
            <div className="rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-6 hover:border-[#D97706]/40 transition-colors">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-1 h-4 bg-gradient-to-b from-[#D97706] to-transparent rounded-full"></div>
                <h3 
                  className="text-[#E8E4D9] text-xs font-medium uppercase tracking-widest"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  Questions by Difficulty
                </h3>
              </div>
              <div className="space-y-4">
                {difficultyBreakdown.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span 
                      className={`font-semibold text-sm uppercase tracking-wider ${item.color}`}
                      style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                    >
                      {item.label}
                    </span>
                    <div className="flex items-center gap-4">
                      <div className="w-32 h-1.5 rounded-full bg-[#1A1814] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${totalQuestions > 0 ? (item.count / totalQuestions) * 100 : 0}%` }}
                          transition={{ duration: 0.8, delay: 0.3 + index * 0.1 }}
                          className={`h-full rounded-full ${item.bg}`}
                        />
                      </div>
                      <span 
                        className="text-[#E8E4D9] w-8 text-right font-bold"
                        style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                      >
                        {item.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Submissions by Status */}
            <div className="rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-6 hover:border-[#D97706]/40 transition-colors">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-1 h-4 bg-gradient-to-b from-[#D97706] to-transparent rounded-full"></div>
                <h3 
                  className="text-[#E8E4D9] text-xs font-medium uppercase tracking-widest"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  Submissions by Status
                </h3>
              </div>
              <div className="space-y-4">
                {submissionBreakdown.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3.5 rounded-lg bg-[#0A0A08] hover:bg-[#1A1814]/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-[#1A1814]">
                        <item.icon className={`h-4 w-4 ${item.color}`} />
                      </div>
                      <span 
                        className="text-[#E8E4D9] text-sm font-medium"
                        style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                      >
                        {item.label}
                      </span>
                    </div>
                    <span 
                      className={`font-bold text-lg ${item.color}`}
                      style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                    >
                      {item.count.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </motion.div>

      {/* Additional Quick Links */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-gradient-to-b from-[#D97706] to-transparent rounded-full"></div>
          <h2 
            className="text-[#E8E4D9] text-xs font-medium uppercase tracking-widest"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            More Actions
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            to="/admin/potd"
            className="group flex items-center gap-4 rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-4 hover:border-[#D97706]/40 transition-colors"
          >
            <div className="p-2.5 rounded-lg bg-[#1A1814] group-hover:bg-[#D97706]/10 transition-colors">
              <Flame className="h-5 w-5 text-[#78716C] group-hover:text-[#D97706] transition-colors" />
            </div>
            <div>
              <h3 
                className="text-[#E8E4D9] font-medium group-hover:text-[#F59E0B] transition-colors"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                POTD Scheduler
              </h3>
              <p 
                className="text-[10px] text-[#78716C] uppercase tracking-wider"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Schedule problem of the day
              </p>
            </div>
          </Link>
          <Link
            to="/admin/contests"
            className="group flex items-center gap-4 rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-4 hover:border-[#D97706]/40 transition-colors"
          >
            <div className="p-2.5 rounded-lg bg-[#1A1814] group-hover:bg-[#D97706]/10 transition-colors">
              <Trophy className="h-5 w-5 text-[#78716C] group-hover:text-[#D97706] transition-colors" />
            </div>
            <div>
              <h3 
                className="text-[#E8E4D9] font-medium group-hover:text-[#F59E0B] transition-colors"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Manage Contests
              </h3>
              <p 
                className="text-[10px] text-[#78716C] uppercase tracking-wider"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Create and manage competitions
              </p>
            </div>
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminDashboard;
