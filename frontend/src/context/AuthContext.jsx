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
        if (!cancelled) setUser(me);
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
        return result;
      },
      async register({ name, email, password, passwordConfirm }) {
        const result = await signup({ name, email, password, passwordConfirm });
        setUser(result.user);
        return result;
      },
      async loginWithGoogle(token) {
        const result = await googleAuth(token);
        setUser(result.user);
        return result;
      },
      async logout() {
        await signout();
        setUser(null);
      },
      setUser,
    }),
    [user, loading]
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
