import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
} from "lucide-react";

const AdminDashboard = () => {
  const { admin } = useAdminAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5" />
        {error}
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Questions",
      value: stats?.questions?.total || 0,
      icon: FileText,
      color: "bg-blue-500",
      link: "/admin/questions",
    },
    {
      title: "Total Test Cases",
      value: stats?.testCases?.total || 0,
      icon: CheckCircle,
      color: "bg-green-500",
      subtext: `${stats?.testCases?.hidden || 0} hidden`,
    },
    {
      title: "Total Submissions",
      value: stats?.submissions?.total || 0,
      icon: TrendingUp,
      color: "bg-purple-500",
    },
    {
      title: "Total Users",
      value: stats?.users || 0,
      icon: Users,
      color: "bg-orange-500",
    },
  ];

  const difficultyBreakdown = [
    { label: "Easy", count: stats?.questions?.byDifficulty?.Easy || 0, color: "text-green-400" },
    { label: "Medium", count: stats?.questions?.byDifficulty?.Medium || 0, color: "text-yellow-400" },
    { label: "Hard", count: stats?.questions?.byDifficulty?.Hard || 0, color: "text-red-400" },
  ];

  const submissionBreakdown = [
    { label: "Accepted", count: stats?.submissions?.byStatus?.accepted || 0, icon: CheckCircle, color: "text-green-400" },
    { label: "Wrong Answer", count: stats?.submissions?.byStatus?.wrong_answer || 0, icon: XCircle, color: "text-red-400" },
    { label: "TLE", count: stats?.submissions?.byStatus?.time_limit_exceeded || 0, icon: Clock, color: "text-yellow-400" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">Welcome back, {admin?.email}</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/admin/upload"
          className="p-4 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/30 hover:border-orange-500/50 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/20">
              <Upload className="h-6 w-6 text-orange-400" />
            </div>
            <div>
              <h3 className="font-medium text-white group-hover:text-orange-400 transition-colors">
                Upload CSV
              </h3>
              <p className="text-sm text-gray-400">Bulk import questions</p>
            </div>
          </div>
        </Link>

        <Link
          to="/admin/questions/new"
          className="p-4 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 hover:border-blue-500/50 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <FileText className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h3 className="font-medium text-white group-hover:text-blue-400 transition-colors">
                New Question
              </h3>
              <p className="text-sm text-gray-400">Create manually</p>
            </div>
          </div>
        </Link>

        <Link
          to="/admin/questions"
          className="p-4 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 hover:border-purple-500/50 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <LayoutDashboard className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <h3 className="font-medium text-white group-hover:text-purple-400 transition-colors">
                Manage Questions
              </h3>
              <p className="text-sm text-gray-400">Edit & view all</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <div
            key={index}
            className="p-5 rounded-xl bg-gray-800/50 border border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">{stat.title}</p>
                <p className="text-3xl font-bold text-white mt-1">{stat.value}</p>
                {stat.subtext && (
                  <p className="text-xs text-gray-500 mt-1">{stat.subtext}</p>
                )}
              </div>
              <div className={`p-3 rounded-xl ${stat.color}/20`}>
                <stat.icon className={`h-6 w-6 ${stat.color.replace("bg-", "text-")}`} />
              </div>
            </div>
            {stat.link && (
              <Link
                to={stat.link}
                className="mt-3 text-sm text-orange-400 hover:text-orange-300 inline-block"
              >
                View all →
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Difficulty Breakdown */}
        <div className="p-6 rounded-xl bg-gray-800/50 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Questions by Difficulty</h3>
          <div className="space-y-3">
            {difficultyBreakdown.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className={`font-medium ${item.color}`}>{item.label}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 rounded-full bg-gray-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.color.replace("text-", "bg-")}`}
                      style={{
                        width: `${stats?.questions?.total ? (item.count / stats.questions.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-gray-400 w-8 text-right">{item.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submission Status Breakdown */}
        <div className="p-6 rounded-xl bg-gray-800/50 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Submissions by Status</h3>
          <div className="space-y-3">
            {submissionBreakdown.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <item.icon className={`h-4 w-4 ${item.color}`} />
                  <span className="text-gray-300">{item.label}</span>
                </div>
                <span className={`font-medium ${item.color}`}>{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
