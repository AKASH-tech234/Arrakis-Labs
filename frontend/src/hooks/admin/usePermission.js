

import { useAuth } from "../../context/AuthContext";

export const usePermission = () => {
  const { user } = useAuth();

  const hasPermission = (permission) => {
    if (!user?.permissions) return false;

    if (user.permissions.includes("*")) return true;

    if (user.permissions.includes(permission)) return true;

    const [resource] = permission.split(":");
    return user.permissions.includes(`${resource}:*`);
  };

  const hasAnyPermission = (...permissions) => {
    return permissions.some((p) => hasPermission(p));
  };

  const hasAllPermissions = (...permissions) => {
    return permissions.every((p) => hasPermission(p));
  };

  const isSuperAdmin = () => {
    return user?.permissions?.includes("*") || user?.role === "super_admin";
  };

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
