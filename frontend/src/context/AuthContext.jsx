import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getMe, signin, signup, signout, googleAuth } from "../services/common/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const me = await getMe();
        if (!cancelled) {
          setUser(me);
          // ═══════════════════════════════════════════════════════════════════
          // USER ID LOGGING - For E2E Testing
          // Copy this ID to use with: python scripts/test_user_flow.py <user_id>
          // ═══════════════════════════════════════════════════════════════════
          if (me && me.id) {
            console.log(
              "═══════════════════════════════════════════════════════════════",
            );
            console.log("🔑 USER_ID:", me.id);
            console.log("📋 Copy this ID to seed test data:");
            console.log(`   python scripts/test_user_flow.py ${me.id}`);
            console.log(
              "═══════════════════════════════════════════════════════════════",
            );
          }
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();

    const handleForcedLogout = () => {
      setUser(null);
    };
    window.addEventListener("auth:logout", handleForcedLogout);

    return () => {
      cancelled = true;
      window.removeEventListener("auth:logout", handleForcedLogout);
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      async login(email, password) {
        const result = await signin({ email, password });
        setUser(result.user);
        // Log user ID after login for E2E testing
        if (result.user && result.user.id) {
          console.log(
            "═══════════════════════════════════════════════════════════════",
          );
          console.log("🔑 USER_ID (after login):", result.user.id);
          console.log("📋 Copy this ID to seed test data:");
          console.log(`   python scripts/test_user_flow.py ${result.user.id}`);
          console.log(
            "═══════════════════════════════════════════════════════════════",
          );
        }
        return result;
      },
      async register({ name, email, password, passwordConfirm }) {
        const result = await signup({ name, email, password, passwordConfirm });
        setUser(result.user);
        // Log user ID after registration for E2E testing
        if (result.user && result.user.id) {
          console.log(
            "═══════════════════════════════════════════════════════════════",
          );
          console.log("🔑 USER_ID (after register):", result.user.id);
          console.log("📋 Copy this ID to seed test data:");
          console.log(`   python scripts/test_user_flow.py ${result.user.id}`);
          console.log(
            "═══════════════════════════════════════════════════════════════",
          );
        }
        return result;
      },
      async loginWithGoogle(token) {
        const result = await googleAuth(token);
        setUser(result.user);
        // Log user ID after Google auth for E2E testing
        if (result.user && result.user.id) {
          console.log(
            "═══════════════════════════════════════════════════════════════",
          );
          console.log("🔑 USER_ID (after Google login):", result.user.id);
          console.log("📋 Copy this ID to seed test data:");
          console.log(`   python scripts/test_user_flow.py ${result.user.id}`);
          console.log(
            "═══════════════════════════════════════════════════════════════",
          );
        }
        return result;
      },
      async logout() {
        await signout();
        setUser(null);
      },
      setUser,
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
