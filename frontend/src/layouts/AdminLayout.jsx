// src/layouts/AdminLayout.jsx
// Main admin shell layout with sidebar and header
import { useState } from "react";
import { Outlet } from "react-router-dom";
import AdminHeader from "../components/admin/layout/AdminHeader";
import AdminSidebar from "../components/admin/layout/AdminSidebar";

export default function AdminLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A08" }}>
      {/* Header */}
      <AdminHeader />

      {/* Sidebar */}
      <AdminSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content */}
      <main
        className={`pt-14 transition-all duration-300 ${
          sidebarCollapsed ? "pl-16" : "pl-56"
        }`}
      >
        <div className="p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
