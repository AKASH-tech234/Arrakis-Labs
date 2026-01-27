import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAdminAuth } from "../../context/AdminAuthContext";
import {
  LayoutDashboard,
  FileText,
  Upload,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  ClipboardList,
  Trophy,
  Flame,
  Calendar,
} from "lucide-react";

const AdminSidebar = () => {
  const { admin, logout, isSuperAdmin } = useAdminAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/admin/login");
  };

  const navItems = [
    {
      to: "/admin/dashboard",
      icon: LayoutDashboard,
      label: "Dashboard",
    },
    {
      to: "/admin/questions",
      icon: FileText,
      label: "Questions",
    },
    {
      to: "/admin/potd",
      icon: Flame,
      label: "POTD Scheduler",
    },
    {
      to: "/admin/contests",
      icon: Trophy,
      label: "Contests",
    },
    {
      to: "/admin/upload",
      icon: Upload,
      label: "CSV Upload",
    },
  ];

  if (isSuperAdmin) {
    navItems.push({
      to: "/admin/audit-logs",
      icon: ClipboardList,
      label: "Audit Logs",
    });
  }

  const NavItem = ({ to, icon: Icon, label }) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
          isActive
            ? "bg-gradient-to-r from-[#D97706]/15 to-transparent text-[#E8E4D9]"
            : "text-[#78716C] hover:text-[#E8E4D9] hover:bg-[#1A1814]/60"
        } ${collapsed ? "justify-center" : ""}`
      }
    >
      {({ isActive }) => (
        <>
          {/* Active indicator bar */}
          {isActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-gradient-to-b from-[#F59E0B] via-[#D97706] to-[#92400E] rounded-full shadow-lg shadow-[#D97706]/30" />
          )}
          
          <div
            className={`flex-shrink-0 p-1.5 rounded-lg transition-all ${
              isActive
                ? "bg-[#D97706]/20 shadow-inner"
                : "bg-transparent group-hover:bg-[#1A1814]"
            }`}
          >
            <Icon
              className={`h-4 w-4 transition-colors ${
                isActive
                  ? "text-[#F59E0B]"
                  : "text-[#78716C] group-hover:text-[#D97706]"
              }`}
            />
          </div>
          
          {!collapsed && (
            <span
              className="text-xs tracking-wider font-medium whitespace-nowrap"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {label}
            </span>
          )}
          
          {/* Pulsing dot for active state */}
          {isActive && !collapsed && (
            <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-[#D97706] shadow-lg shadow-[#D97706]/50 animate-pulse" />
          )}
        </>
      )}
    </NavLink>
  );

  return (
    <aside
      className={`flex flex-col transition-all duration-300 border-r border-[#1A1814] ${
        collapsed ? "w-[72px]" : "w-60"
      }`}
      style={{
        background: "linear-gradient(180deg, #0D0D0B 0%, #0A0A08 100%)",
      }}
    >
      {/* Logo Header */}
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

      {/* Collapse Toggle - positioned on edge */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full border border-[#1A1814] bg-[#0D0D0B] 
                   flex items-center justify-center text-[#78716C] hover:text-[#D97706] 
                   hover:border-[#D97706]/50 hover:bg-[#D97706]/10 transition-all duration-200 shadow-lg z-10"
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[#1A1814] scrollbar-track-transparent">
        {navItems.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      {/* User Section & Logout */}
      <div className="p-3 border-t border-[#1A1814]">
        {/* User info */}
        {!collapsed && (
          <div className="px-3 py-2 mb-2 rounded-lg bg-[#0F0F0D]">
            <p 
              className="text-xs text-[#E8E4D9] font-medium truncate"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {admin?.email}
            </p>
            <p 
              className="text-[10px] text-[#78716C] uppercase tracking-wider"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {admin?.role?.replace("_", " ")}
            </p>
          </div>
        )}

        {/* Logout button */}
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#78716C] hover:text-[#92400E] hover:bg-[#92400E]/10 transition-all duration-200 group ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <div className="p-1.5 rounded-lg bg-transparent group-hover:bg-[#92400E]/10 transition-all">
            <LogOut className="h-4 w-4 flex-shrink-0 group-hover:text-[#92400E]" />
          </div>
          {!collapsed && (
            <span 
              className="text-xs tracking-wider font-medium"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Logout
            </span>
          )}
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
