import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { Shield, Mail, Lock, AlertCircle, Loader2 } from "lucide-react";

const AdminLogin = () => {
  const { login, isAuthenticated, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0A0A08]">
        <Loader2 className="h-10 w-10 animate-spin text-[#D97706]" />
        <p className="text-[#78716C] mt-4">Loading...</p>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!email || !password) {
      setError("Email and password are required");
      setLoading(false);
      return;
    }

    const result = await login(email, password);
    
    if (result.success) {
      navigate("/admin/dashboard");
    } else {
      setError(result.message || "Invalid credentials");
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A08]" style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}>
      {}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#D97706]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#D97706]/3 rounded-full blur-3xl" />
      </div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md px-6 relative z-10"
      >
        {}
        <div className="text-center mb-8">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#D97706]/20 to-[#D97706]/5 border border-[#D97706]/30 mb-6 shadow-lg shadow-[#D97706]/10"
          >
            <Shield className="h-10 w-10 text-[#D97706]" />
          </motion.div>
          <h1 className="text-3xl font-bold text-[#E8E4D9] uppercase tracking-wider">Admin Portal</h1>
          <p className="text-[#78716C] mt-2">Mentat Trials Management Console</p>
        </div>

        {}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#0F0F0D] backdrop-blur-sm rounded-2xl border border-[#1A1814] p-8 shadow-2xl"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400"
              >
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </motion.div>
            )}

            <div>
              <label className="block text-sm font-semibold text-[#78716C] mb-2 uppercase tracking-wide">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#78716C]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-[#0A0A08] border border-[#1A1814] text-[#E8E4D9] placeholder-[#78716C] focus:outline-none focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706]/50 transition-all"
                  placeholder="admin@mentat.dev"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#78716C] mb-2 uppercase tracking-wide">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#78716C]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-[#0A0A08] border border-[#1A1814] text-[#E8E4D9] placeholder-[#78716C] focus:outline-none focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706]/50 transition-all"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#D97706] to-amber-600 text-white font-semibold uppercase tracking-wider hover:from-[#D97706]/90 hover:to-amber-600/90 focus:outline-none focus:ring-2 focus:ring-[#D97706]/50 focus:ring-offset-2 focus:ring-offset-[#0F0F0D] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-[#D97706]/20"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[#1A1814]">
            <p className="text-center text-sm text-[#78716C]">
              Admin accounts are created via seed scripts only.
              <br />
              Contact your system administrator for access.
            </p>
          </div>
        </motion.div>

        {}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 text-center"
        >
          <a
            href="/"
            className="text-[#78716C] hover:text-[#D97706] text-sm transition-colors font-medium"
          >
            ← Back to main site
          </a>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default AdminLogin;
