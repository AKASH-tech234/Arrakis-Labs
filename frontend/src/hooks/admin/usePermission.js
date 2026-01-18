// src/hooks/admin/usePermission.js
// Permission checking hook for admin panel

import { useAuth } from "../../context/AuthContext";

/**
 * Hook to check user permissions in the admin panel
 */
export const usePermission = () => {
  const { user } = useAuth();

  /**
   * Check if user has a specific permission
   * @param {string} permission - Permission string (e.g., 'problems:create')
   * @returns {boolean}
   */
  const hasPermission = (permission) => {
    if (!user?.permissions) return false;

    // Super admin has all permissions
    if (user.permissions.includes("*")) return true;

    // Check exact match
    if (user.permissions.includes(permission)) return true;

    // Check wildcard (e.g., 'problems:*' matches 'problems:create')
    const [resource] = permission.split(":");
    return user.permissions.includes(`${resource}:*`);
  };

  /**
   * Check if user has any of the specified permissions
   * @param  {...string} permissions - Permission strings
   * @returns {boolean}
   */
  const hasAnyPermission = (...permissions) => {
    return permissions.some((p) => hasPermission(p));
  };

  /**
   * Check if user has all of the specified permissions
   * @param  {...string} permissions - Permission strings
   * @returns {boolean}
   */
  const hasAllPermissions = (...permissions) => {
    return permissions.every((p) => hasPermission(p));
  };

  /**
   * Check if user is a super admin
   * @returns {boolean}
   */
  const isSuperAdmin = () => {
    return user?.permissions?.includes("*") || user?.role === "super_admin";
  };

  /**
   * Check if user is any type of admin
   * @returns {boolean}
   */
  const isAdmin = () => {
    return user?.role && user.role !== "user";
  };

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isSuperAdmin,
    isAdmin,
    permissions: user?.permissions || [],
    role: user?.role,
  };
};

export default usePermission;
