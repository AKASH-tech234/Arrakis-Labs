

import { useState } from "react";
import { Outlet } from "react-router-dom";
import AdminSidebar from "../components/admin/layout/AdminSidebar";

export default function AdminLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A08" }}>
      {/* Sidebar with integrated header */}
      <AdminSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content */}
      <main
        className={`min-h-screen transition-all duration-300 ${
          sidebarCollapsed ? "pl-[72px]" : "pl-60"
        }`}
      >
        <div className="p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
