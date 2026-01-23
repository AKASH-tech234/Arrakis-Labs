import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
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

  // Super admin only items
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
        `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
          isActive
            ? "bg-orange-500/20 text-orange-400"
            : "text-gray-400 hover:text-white hover:bg-gray-800"
        } ${collapsed ? "justify-center" : ""}`
      }
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      {!collapsed && <span className="font-medium">{label}</span>}
    </NavLink>
  );

  return (
    <aside
      className={`bg-gray-800/50 border-r border-gray-700 flex flex-col transition-all duration-300 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Logo */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-orange-500/20">
              <Shield className="h-5 w-5 text-orange-400" />
            </div>
            <span className="font-bold text-white">Admin Panel</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors ${
            collapsed ? "mx-auto" : ""
          }`}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      {/* User Section */}
      <div className="p-3 border-t border-gray-700">
        {/* Admin Info */}
        {!collapsed && (
          <div className="px-3 py-2 mb-2">
            <p className="text-sm text-white font-medium truncate">{admin?.email}</p>
            <p className="text-xs text-gray-500 capitalize">{admin?.role?.replace("_", " ")}</p>
          </div>
        )}

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span className="font-medium">Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
