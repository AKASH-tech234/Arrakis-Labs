

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
      { path: "/admin/problems", label: "Problems", icon: FileText },
      { path: "/admin/contests", label: "Contests", icon: Trophy },
      { path: "/admin/potd", label: "POTD Scheduler", icon: Flame },
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
      className={`fixed left-0 top-14 bottom-0 border-r border-[#1A1814] transition-all duration-300 z-40 ${
        collapsed ? "w-16" : "w-56"
      }`}
      style={{
        background: "linear-gradient(180deg, #0F0F0D 0%, #0A0A08 100%)",
      }}
    >
      {/* Collapse Toggle Button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-6 w-6 h-6 rounded-full border border-[#1A1814] bg-[#0F0F0D] 
                   flex items-center justify-center text-[#78716C] hover:text-[#D97706] 
                   hover:border-[#D97706]/50 hover:bg-[#D97706]/10 transition-all duration-200 shadow-lg"
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Navigation */}
      <nav className="h-full overflow-y-auto py-4 px-2 scrollbar-thin scrollbar-thumb-[#1A1814] scrollbar-track-transparent">
        {navSections.map((section) => (
          <div key={section.id} className="mb-3">
            {/* Section Title */}
            {section.title && !collapsed && (
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between px-3 py-2 
                           text-[#78716C] hover:text-[#D97706] transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <div className="w-0.5 h-3 bg-gradient-to-b from-[#D97706]/50 to-transparent rounded-full" />
                  <span
                    className="text-[10px] uppercase tracking-[0.2em] font-medium"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    {section.title}
                  </span>
                </div>
                {expandedSections.includes(section.id) ? (
                  <ChevronDown className="h-3 w-3 text-[#3D3D3D] group-hover:text-[#D97706]" />
                ) : (
                  <ChevronUp className="h-3 w-3 text-[#3D3D3D] group-hover:text-[#D97706]" />
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
                  className="overflow-hidden"
                >
                  {section.items.map((item) => {
                    const IconComponent = item.icon;
                    const active = isActive(item.path, item.exact);

                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.exact}
                        className={`relative flex items-center gap-3 px-3 py-2.5 mx-1 my-0.5 rounded-lg
                                    transition-all duration-200 group ${
                                      active
                                        ? "bg-[#D97706]/10 text-[#E8E4D9] border border-[#D97706]/30"
                                        : "text-[#78716C] hover:text-[#E8E4D9] hover:bg-[#1A1814]/80 border border-transparent hover:border-[#1A1814]"
                                    }`}
                        title={collapsed ? item.label : undefined}
                      >
                        {/* Active indicator bar */}
                        {active && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-gradient-to-b from-[#D97706] to-[#F59E0B] rounded-full" />
                        )}

                        <div
                          className={`p-1.5 rounded-md transition-colors ${
                            active
                              ? "bg-[#D97706]/20"
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
                            className={`text-xs uppercase tracking-wider font-medium ${
                              active ? "text-[#E8E4D9]" : ""
                            }`}
                            style={{
                              fontFamily: "'Rajdhani', system-ui, sans-serif",
                            }}
                          >
                            {item.label}
                          </span>
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
          <div className="mt-6 pt-4 border-t border-[#1A1814]">
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="w-0.5 h-3 bg-gradient-to-b from-[#92400E]/50 to-transparent rounded-full" />
              <span
                className="text-[10px] uppercase tracking-[0.2em] font-medium text-[#92400E]"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Danger Zone
              </span>
            </div>
            <NavLink
              to="/admin/danger"
              className={({ isActive }) =>
                `relative flex items-center gap-3 px-3 py-2.5 mx-1 my-0.5 rounded-lg
                 transition-all duration-200 group ${
                   isActive
                     ? "bg-[#92400E]/10 text-[#92400E] border border-[#92400E]/30"
                     : "text-[#78716C] hover:text-[#92400E] hover:bg-[#92400E]/10 border border-transparent"
                 }`
              }
            >
              <div className="p-1.5 rounded-md bg-transparent group-hover:bg-[#92400E]/10">
                <AlertTriangle className="h-4 w-4 text-[#92400E]" />
              </div>
              <span
                className="text-xs uppercase tracking-wider font-medium"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                System Reset
              </span>
            </NavLink>
          </div>
        )}

        {/* Collapsed Danger Zone */}
        {collapsed && (
          <div className="mt-6 pt-4 border-t border-[#1A1814]">
            <NavLink
              to="/admin/danger"
              title="System Reset"
              className={({ isActive }) =>
                `relative flex items-center justify-center p-2.5 mx-1 my-0.5 rounded-lg
                 transition-all duration-200 group ${
                   isActive
                     ? "bg-[#92400E]/10 border border-[#92400E]/30"
                     : "hover:bg-[#92400E]/10 border border-transparent"
                 }`
              }
            >
              <AlertTriangle className="h-4 w-4 text-[#92400E]" />
            </NavLink>
          </div>
        )}
      </nav>
    </aside>
  );
}
