import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { adminLogin as apiAdminLogin, adminLogout as apiAdminLogout, getAdminProfile } from "../services/adminApi";

const AdminAuthContext = createContext(null);

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
};

export const AdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check for existing admin session on mount
  useEffect(() => {
    const checkAdminAuth = async () => {
      const token = localStorage.getItem("adminToken");
      const storedAdmin = localStorage.getItem("adminUser");

      if (token && storedAdmin) {
        try {
          // Verify token is still valid
          const response = await getAdminProfile();
          if (response.success) {
            setAdmin(response.admin);
          } else {
            // Token invalid, clear storage
            localStorage.removeItem("adminToken");
            localStorage.removeItem("adminUser");
          }
        } catch (err) {
          // Token expired or invalid
          localStorage.removeItem("adminToken");
          localStorage.removeItem("adminUser");
        }
      }
      setLoading(false);
    };

    checkAdminAuth();
  }, []);

  const login = useCallback(async (email, password) => {
    setError(null);
    setLoading(true);
    try {
      const response = await apiAdminLogin(email, password);
      if (response.success) {
        setAdmin(response.admin);
        return { success: true };
      } else {
        setError(response.message || "Login failed");
        return { success: false, message: response.message };
      }
    } catch (err) {
      const message = err.response?.data?.message || "Login failed";
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiAdminLogout();
    } catch (err) {
      // Ignore logout errors
    } finally {
      setAdmin(null);
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminUser");
    }
  }, []);

  const value = {
    admin,
    loading,
    error,
    isAuthenticated: !!admin,
    isSuperAdmin: admin?.role === "super_admin",
    login,
    logout,
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export default AdminAuthContext;
