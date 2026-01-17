// src/components/admin/layout/AdminSidebar.jsx
// Collapsible sidebar navigation following Arrakis Labs Dune theme
import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

const navSections = [
  {
    id: "dashboard",
    title: null, // No section header for dashboard
    items: [{ path: "/admin", label: "Dashboard", icon: "◈", exact: true }],
  },
  {
    id: "content",
    title: "Content",
    items: [
      { path: "/admin/problems", label: "Problems", icon: "⬡" },
      { path: "/admin/contests", label: "Contests", icon: "◇" },
    ],
  },
  {
    id: "execution",
    title: "Execution",
    items: [
      { path: "/admin/execution/config", label: "Judge Config", icon: "⚙" },
      { path: "/admin/submissions", label: "Submissions", icon: "▤" },
      { path: "/admin/plagiarism", label: "Plagiarism", icon: "⊘" },
    ],
  },
  {
    id: "competition",
    title: "Competition",
    items: [{ path: "/admin/leaderboards", label: "Leaderboards", icon: "⬢" }],
  },
  {
    id: "users",
    title: "Users",
    items: [
      { path: "/admin/users", label: "User Management", icon: "◎" },
      { path: "/admin/roles", label: "Roles", icon: "⛊" },
    ],
  },
  {
    id: "system",
    title: "System",
    items: [
      { path: "/admin/system", label: "Services", icon: "⬣" },
      { path: "/admin/system/audit", label: "Audit Logs", icon: "☰" },
    ],
  },
];

export default function AdminSidebar({ collapsed, onToggle }) {
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState(
    navSections.map((s) => s.id),
  );

  const toggleSection = (sectionId) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId],
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
      style={{ backgroundColor: "#0A0A08" }}
    >
      {/* Collapse Toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-6 w-6 h-6 border border-[#1A1814] bg-[#0D0D0B] 
                   flex items-center justify-center text-[#78716C] hover:text-[#E8E4D9] 
                   hover:border-[#78716C] transition-colors duration-200"
        style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
      >
        {collapsed ? "›" : "‹"}
      </button>

      {/* Navigation */}
      <nav className="h-full overflow-y-auto py-4 px-2">
        {navSections.map((section) => (
          <div key={section.id} className="mb-4">
            {/* Section Header */}
            {section.title && !collapsed && (
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between px-3 py-2 
                           text-[#3D3D3D] hover:text-[#78716C] transition-colors"
              >
                <span
                  className="text-[10px] uppercase tracking-[0.15em]"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  {section.title}
                </span>
                <span className="text-[8px]">
                  {expandedSections.includes(section.id) ? "▼" : "▶"}
                </span>
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
                >
                  {section.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.exact}
                      className={`flex items-center gap-3 px-3 py-2.5 mx-1 my-0.5
                                  transition-all duration-200 group ${
                                    isActive(item.path, item.exact)
                                      ? "bg-[#1A1814] text-[#E8E4D9]"
                                      : "text-[#78716C] hover:text-[#E8E4D9] hover:bg-[#1A1814]/50"
                                  }`}
                      title={collapsed ? item.label : undefined}
                    >
                      <span
                        className={`text-sm ${
                          isActive(item.path, item.exact)
                            ? "text-[#F59E0B]"
                            : "text-[#78716C] group-hover:text-[#D97706]"
                        }`}
                      >
                        {item.icon}
                      </span>
                      {!collapsed && (
                        <span
                          className="text-xs uppercase tracking-wider"
                          style={{
                            fontFamily: "'Rajdhani', system-ui, sans-serif",
                          }}
                        >
                          {item.label}
                        </span>
                      )}
                      {/* Active indicator */}
                      {isActive(item.path, item.exact) && (
                        <span className="ml-auto w-1 h-4 bg-[#F59E0B]" />
                      )}
                    </NavLink>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}

        {/* Danger Zone - At Bottom */}
        {!collapsed && (
          <div className="mt-8 pt-4 border-t border-[#1A1814]/50">
            <span
              className="block px-3 py-2 text-[10px] uppercase tracking-[0.15em] text-[#92400E]"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Danger Zone
            </span>
            <NavLink
              to="/admin/danger"
              className="flex items-center gap-3 px-3 py-2.5 mx-1 my-0.5
                         text-[#78716C] hover:text-[#92400E] hover:bg-[#92400E]/10
                         transition-all duration-200"
            >
              <span className="text-sm text-[#92400E]">⚠</span>
              <span
                className="text-xs uppercase tracking-wider"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                System Reset
              </span>
            </NavLink>
          </div>
        )}
      </nav>
    </aside>
  );
}
