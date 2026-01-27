

import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  FileText,
  Trophy,
  Flame,
  Settings,
  FileCheck,
  ShieldAlert,
  Medal,
  Users,
  Shield,
  Server,
  ScrollText,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Upload,
} from "lucide-react";

const navSections = [
  {
    id: "dashboard",
    title: null,
    items: [
      { path: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    id: "content",
    title: "Content",
    items: [
      { path: "/admin/questions", label: "Questions", icon: FileText },
      { path: "/admin/potd", label: "POTD Scheduler", icon: Flame },
      { path: "/admin/contests", label: "Contests", icon: Trophy },
      { path: "/admin/csv-upload", label: "CSV Upload", icon: Upload },
    ],
  },
  {
    id: "execution",
    title: "Execution",
    items: [
      { path: "/admin/execution/config", label: "Judge Config", icon: Settings },
      { path: "/admin/submissions", label: "Submissions", icon: FileCheck },
      { path: "/admin/plagiarism", label: "Plagiarism", icon: ShieldAlert },
    ],
  },
  {
    id: "competition",
    title: "Competition",
    items: [{ path: "/admin/leaderboards", label: "Leaderboards", icon: Medal }],
  },
  {
    id: "users",
    title: "Users",
    items: [
      { path: "/admin/users", label: "User Management", icon: Users },
      { path: "/admin/roles", label: "Roles", icon: Shield },
    ],
  },
  {
    id: "system",
    title: "System",
    items: [
      { path: "/admin/system", label: "Services", icon: Server },
      { path: "/admin/system/audit", label: "Audit Logs", icon: ScrollText },
    ],
  },
];

export default function AdminSidebar({ collapsed, onToggle }) {
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState(
    navSections.map((s) => s.id)
  );

  const toggleSection = (sectionId) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const isActive = (path, exact = false) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <aside
      className={`fixed left-0 top-0 bottom-0 border-r border-[#1A1814] transition-all duration-300 z-40 ${
        collapsed ? "w-[72px]" : "w-60"
      }`}
      style={{
        background: "linear-gradient(180deg, #0D0D0B 0%, #0A0A08 100%)",
      }}
    >
      {/* Logo Section */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[#1A1814]">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#D97706] to-[#92400E] flex items-center justify-center shadow-lg shadow-[#D97706]/20">
              <Shield className="w-5 h-5 text-[#0A0A08]" />
            </div>
            <div className="flex flex-col">
              <span
                className="text-[#E8E4D9] font-semibold text-sm tracking-wider"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Admin Panel
              </span>
              <span
                className="text-[#78716C] text-[10px] tracking-[0.15em] uppercase -mt-0.5"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Mentat Trials
              </span>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-full flex justify-center">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#D97706] to-[#92400E] flex items-center justify-center shadow-lg shadow-[#D97706]/20">
              <Shield className="w-5 h-5 text-[#0A0A08]" />
            </div>
          </div>
        )}
      </div>

      {/* Collapse Toggle Button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full border border-[#1A1814] bg-[#0D0D0B] 
                   flex items-center justify-center text-[#78716C] hover:text-[#D97706] 
                   hover:border-[#D97706]/50 hover:bg-[#D97706]/10 transition-all duration-200 shadow-lg">
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Navigation */}
      <nav className="h-[calc(100%-4rem)] overflow-y-auto py-4 px-3 scrollbar-thin scrollbar-thumb-[#1A1814] scrollbar-track-transparent">
        {navSections.map((section) => (
          <div key={section.id} className="mb-4">
            {/* Section Title */}
            {section.title && !collapsed && (
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between px-2 py-2 mb-1
                           text-[#78716C] hover:text-[#D97706] transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <div className="w-1 h-3.5 bg-gradient-to-b from-[#D97706] to-transparent rounded-full" />
                  <span
                    className="text-[10px] uppercase tracking-[0.2em] font-semibold"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    {section.title}
                  </span>
                </div>
                {expandedSections.includes(section.id) ? (
                  <ChevronDown className="h-3 w-3 text-[#3D3D3D] group-hover:text-[#D97706] transition-colors" />
                ) : (
                  <ChevronUp className="h-3 w-3 text-[#3D3D3D] group-hover:text-[#D97706] transition-colors" />
                )}
              </button>
            )}

            {/* Section Items */}
            <AnimatePresence initial={false}>
              {(expandedSections.includes(section.id) || collapsed) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden space-y-1"
                >
                  {section.items.map((item) => {
                    const IconComponent = item.icon;
                    const active = isActive(item.path, item.exact);

                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.exact}
                        className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg
                                    transition-all duration-200 group ${
                                      active
                                        ? "bg-gradient-to-r from-[#D97706]/15 to-transparent text-[#E8E4D9]"
                                        : "text-[#78716C] hover:text-[#E8E4D9] hover:bg-[#1A1814]/60"
                                    } ${collapsed ? "justify-center" : ""}`}
                        title={collapsed ? item.label : undefined}
                      >
                        {/* Active indicator bar */}
                        {active && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-gradient-to-b from-[#F59E0B] via-[#D97706] to-[#92400E] rounded-full shadow-lg shadow-[#D97706]/30" />
                        )}

                        <div
                          className={`flex-shrink-0 p-1.5 rounded-lg transition-all ${
                            active
                              ? "bg-[#D97706]/20 shadow-inner"
                              : "bg-transparent group-hover:bg-[#1A1814]"
                          }`}
                        >
                          <IconComponent
                            className={`h-4 w-4 transition-colors ${
                              active
                                ? "text-[#F59E0B]"
                                : "text-[#78716C] group-hover:text-[#D97706]"
                            }`}
                          />
                        </div>

                        {!collapsed && (
                          <span
                            className={`text-xs tracking-wider font-medium whitespace-nowrap ${
                              active ? "text-[#E8E4D9]" : ""
                            }`}
                            style={{
                              fontFamily: "'Rajdhani', system-ui, sans-serif",
                            }}
                          >
                            {item.label}
                          </span>
                        )}

                        {/* Hover glow effect */}
                        {active && !collapsed && (
                          <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-[#D97706] shadow-lg shadow-[#D97706]/50 animate-pulse" />
                        )}
                      </NavLink>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}

        {/* Danger Zone */}
        {!collapsed && (
          <div className="mt-6 pt-4 border-t border-[#1A1814]/60">
            <div className="flex items-center gap-2 px-2 py-2 mb-1">
              <div className="w-1 h-3.5 bg-gradient-to-b from-[#92400E] to-transparent rounded-full" />
              <span
                className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#92400E]"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Danger Zone
              </span>
            </div>
            <NavLink
              to="/admin/danger"
              className={({ isActive }) =>
                `relative flex items-center gap-3 px-3 py-2.5 rounded-lg
                 transition-all duration-200 group ${
                   isActive
                     ? "bg-gradient-to-r from-[#92400E]/15 to-transparent text-[#92400E]"
                     : "text-[#78716C] hover:text-[#92400E] hover:bg-[#92400E]/10"
                 }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-gradient-to-b from-[#DC2626] to-[#92400E] rounded-full" />
                  )}
                  <div className="p-1.5 rounded-lg bg-transparent group-hover:bg-[#92400E]/10 transition-all">
                    <AlertTriangle className="h-4 w-4 text-[#92400E]" />
                  </div>
                  <span
                    className="text-xs tracking-wider font-medium"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    System Reset
                  </span>
                </>
              )}
            </NavLink>
          </div>
        )}

        {/* Collapsed Danger Zone */}
        {collapsed && (
          <div className="mt-6 pt-4 border-t border-[#1A1814]/60">
            <NavLink
              to="/admin/danger"
              title="System Reset"
              className={({ isActive }) =>
                `relative flex items-center justify-center p-2.5 rounded-lg mx-1
                 transition-all duration-200 group ${
                   isActive
                     ? "bg-[#92400E]/15"
                     : "hover:bg-[#92400E]/10"
                 }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-gradient-to-b from-[#DC2626] to-[#92400E] rounded-full" />
                  )}
                  <div className="p-1.5 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-[#92400E]" />
                  </div>
                </>
              )}
            </NavLink>
          </div>
        )}
      </nav>
    </aside>
  );
}
