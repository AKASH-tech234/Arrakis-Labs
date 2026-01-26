

import { motion } from "framer-motion";

const stats = [
  { label: "Total Problems", value: "247", change: "+12 this week", icon: "⬡" },
  { label: "Active Contests", value: "3", change: "2 scheduled", icon: "◇" },
  {
    label: "Total Users",
    value: "12,458",
    change: "+342 this month",
    icon: "◎",
  },
  {
    label: "Submissions Today",
    value: "1,847",
    change: "+23% vs yesterday",
    icon: "▤",
  },
];

const recentActivity = [
  {
    action: "Problem created",
    target: "Binary Tree Inorder",
    user: "alice_admin",
    time: "5m ago",
  },
  {
    action: "Contest published",
    target: "Weekly Challenge #43",
    user: "bob_admin",
    time: "1h ago",
  },
  {
    action: "User banned",
    target: "spam_user_123",
    user: "alice_admin",
    time: "2h ago",
  },
  {
    action: "Plagiarism flagged",
    target: "Submission #45821",
    user: "system",
    time: "3h ago",
  },
  {
    action: "Problem updated",
    target: "Two Sum",
    user: "carol_admin",
    time: "4h ago",
  },
];

const systemStatus = [
  { name: "Backend API", status: "healthy", latency: "45ms" },
  { name: "MongoDB", status: "healthy", latency: "12ms" },
  { name: "Judge Workers", status: "degraded", info: "4/5 active" },
  { name: "AI Services", status: "healthy", latency: "230ms" },
  { name: "Redis Cache", status: "healthy", hitRate: "94%" },
];

const pendingItems = [
  { type: "Plagiarism", count: 7, route: "/admin/plagiarism" },
  { type: "Problem Reviews", count: 3, route: "/admin/problems?status=review" },
  { type: "User Reports", count: 12, route: "/admin/users?flagged=true" },
];

export default function AdminDashboard() {
  return (
    <div className="space-y-8">
      {}
      <div>
        <h1
          className="text-[#E8E4D9] text-xl uppercase tracking-[0.2em]"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          Dashboard
        </h1>
        <p
          className="text-[#78716C] text-xs uppercase tracking-wider mt-1"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          System overview and quick actions
        </p>
      </div>

      {}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="border border-[#1A1814] p-5"
            style={{ backgroundColor: "#0D0D0B" }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p
                  className="text-[#78716C] text-[10px] uppercase tracking-wider"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  {stat.label}
                </p>
                <p
                  className="text-[#E8E4D9] text-2xl mt-1"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  {stat.value}
                </p>
                <p
                  className="text-[#78716C] text-[10px] uppercase tracking-wider mt-2"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  {stat.change}
                </p>
              </div>
              <span className="text-[#F59E0B] text-xl">{stat.icon}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {}
        <div
          className="lg:col-span-2 border border-[#1A1814]"
          style={{ backgroundColor: "#0D0D0B" }}
        >
          <div className="px-5 py-4 border-b border-[#1A1814]">
            <h2
              className="text-[#E8E4D9] text-sm uppercase tracking-[0.15em]"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Recent Activity
            </h2>
          </div>
          <div className="divide-y divide-[#1A1814]/50">
            {recentActivity.map((activity, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="px-5 py-3 hover:bg-[#1A1814]/30 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p
                      className="text-[#E8E4D9] text-xs"
                      style={{
                        fontFamily: "'Rajdhani', system-ui, sans-serif",
                      }}
                    >
                      <span className="text-[#78716C]">{activity.action}:</span>{" "}
                      {activity.target}
                    </p>
                    <p
                      className="text-[#78716C] text-[10px] uppercase tracking-wider mt-0.5"
                      style={{
                        fontFamily: "'Rajdhani', system-ui, sans-serif",
                      }}
                    >
                      by {activity.user}
                    </p>
                  </div>
                  <span
                    className="text-[#78716C] text-[10px] uppercase tracking-wider"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    {activity.time}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-[#1A1814]">
            <a
              href="/admin/system/audit"
              className="text-[#D97706] hover:text-[#F59E0B] text-xs uppercase tracking-wider transition-colors"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              View All Activity →
            </a>
          </div>
        </div>

        {}
        <div className="space-y-6">
          {}
          <div
            className="border border-[#1A1814]"
            style={{ backgroundColor: "#0D0D0B" }}
          >
            <div className="px-5 py-4 border-b border-[#1A1814]">
              <h2
                className="text-[#E8E4D9] text-sm uppercase tracking-[0.15em]"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Pending Review
              </h2>
            </div>
            <div className="p-5 space-y-3">
              {pendingItems.map((item) => (
                <a
                  key={item.type}
                  href={item.route}
                  className="flex items-center justify-between p-3 border border-[#1A1814] 
                             hover:border-[#78716C] transition-colors group"
                >
                  <span
                    className="text-[#78716C] group-hover:text-[#E8E4D9] text-xs uppercase tracking-wider transition-colors"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    {item.type}
                  </span>
                  <span
                    className="px-2 py-0.5 bg-[#F59E0B]/20 text-[#F59E0B] text-xs"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    {item.count}
                  </span>
                </a>
              ))}
            </div>
          </div>

          {}
          <div
            className="border border-[#1A1814]"
            style={{ backgroundColor: "#0D0D0B" }}
          >
            <div className="px-5 py-4 border-b border-[#1A1814]">
              <h2
                className="text-[#E8E4D9] text-sm uppercase tracking-[0.15em]"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                System Status
              </h2>
            </div>
            <div className="p-5 space-y-3">
              {systemStatus.map((service) => (
                <div
                  key={service.name}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 ${
                        service.status === "healthy"
                          ? "bg-green-500"
                          : service.status === "degraded"
                            ? "bg-[#F59E0B]"
                            : "bg-red-500"
                      }`}
                    />
                    <span
                      className="text-[#E8E4D9] text-xs uppercase tracking-wider"
                      style={{
                        fontFamily: "'Rajdhani', system-ui, sans-serif",
                      }}
                    >
                      {service.name}
                    </span>
                  </div>
                  <span
                    className="text-[#78716C] text-[10px] uppercase tracking-wider"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    {service.latency || service.info || service.hitRate}
                  </span>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-[#1A1814]">
              <a
                href="/admin/system"
                className="text-[#D97706] hover:text-[#F59E0B] text-xs uppercase tracking-wider transition-colors"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                View Details →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
