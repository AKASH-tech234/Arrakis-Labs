// src/components/auth/AdminRoute.jsx
// Protected route wrapper for admin-only access
import { Navigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";

export default function AdminRoute({ children }) {
  const [adminUser, setAdminUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    // Check for admin token in localStorage
    const token = localStorage.getItem("adminToken");
    const user = localStorage.getItem("adminUser");

    if (token && user) {
      try {
        const parsedUser = JSON.parse(user);
        if (parsedUser.role === "admin") {
          setAdminUser(parsedUser);
        }
      } catch (e) {
        console.error("Error parsing admin user:", e);
      }
    }
    setLoading(false);
  }, []);

  // Show loading state
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#0A0A08" }}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-[#1A1814] border-t-[#F59E0B] rounded-full animate-spin" />
          <p
            className="text-[#78716C] text-xs uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Authenticating...
          </p>
        </div>
      </div>
    );
  }

  // Not logged in as admin - redirect to admin login
  if (!adminUser) {
    return (
      <Navigate to="/admin/login" state={{ from: location.pathname }} replace />
    );
  }

  return children;
}
