// src/pages/Login.jsx - Dune-Inspired
import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import ArrakisLogo from "../../components/ui/ArrakisLogo";
import { useAuth } from "../../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || "/problems";

  const handleGoogleResponse = async (response) => {
    setError("");
    setSubmitting(true);

    try {
      if (!response.credential) {
        throw new Error("No credentials received from Google");
      }
      
      await loginWithGoogle(response.credential);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || "Google login failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = () => {
    if (window.google) {
      window.google.accounts.id.renderButton(
        document.getElementById("google-button"),
        { theme: "dark", size: "large" }
      );
    }
  };

  useEffect(() => {
    // Initialize Google Sign-In after component mounts
    const timer = setTimeout(() => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || "208012919124-f2s18cpj845hogatl2ptg451vnt5lju2.apps.googleusercontent.com",
          callback: handleGoogleResponse,
        });
        // Render button immediately
        handleGoogleSignIn();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login(email, password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ backgroundColor: "#0A0A08" }}
    >
      {/* Background glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[350px] blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, rgba(217, 119, 6, 0.06) 0%, transparent 70%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Brand */}
        <div className="text-center mb-12">
          <Link to="/" className="inline-block">
            <ArrakisLogo size="lg" showWordmark={true} animated={true} />
          </Link>
        </div>

        {/* Login Card - Angular, no rounded corners */}
        <div
          className="border border-[#1A1814] p-8 md:p-10"
          style={{ backgroundColor: "#0D0D0B" }}
        >
          <h2
            className="text-xl font-medium text-[#E8E4D9] mb-2 text-center uppercase tracking-[0.15em]"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Enter the System
          </h2>
          <p
            className="text-[#78716C] text-center mb-8 text-xs tracking-wider uppercase"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Authenticate to continue
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div
                className="border border-[#92400E]/40 bg-[#92400E]/10 px-4 py-3 text-xs text-[#D97706]"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                {error}
              </div>
            )}
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-[#78716C] text-xs mb-2 uppercase tracking-wider"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Identifier
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0A0A08] border border-[#1A1814] text-[#E8E4D9] px-4 py-3 text-sm
                         focus:outline-none focus:border-[#92400E]/50 transition-all duration-200
                         placeholder:text-[#3D3D3D]"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                placeholder="your@identifier.com"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-[#78716C] text-xs mb-2 uppercase tracking-wider"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Passkey
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0A0A08] border border-[#1A1814] text-[#E8E4D9] px-4 py-3 text-sm
                         focus:outline-none focus:border-[#92400E]/50 transition-all duration-200
                         placeholder:text-[#3D3D3D]"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                placeholder="••••••••"
              />
            </div>

            {/* Forgot password */}
            <div className="text-right">
              <a
                href="#"
                className="text-[#D97706] hover:text-[#F59E0B] text-xs transition-colors uppercase tracking-wider"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Reset Passkey
              </a>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-[#92400E] to-[#D97706] text-[#0A0A08] py-3.5 font-semibold text-xs tracking-[0.15em] uppercase
                       hover:from-[#D97706] hover:to-[#F59E0B] transition-all duration-300"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {submitting ? "Authenticating..." : "Authenticate"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-px bg-[#1A1814]" />
            <span
              className="text-[#3D3D3D] text-xs uppercase tracking-wider"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              or
            </span>
            <div className="flex-1 h-px bg-[#1A1814]" />
          </div>

          {/* Google Sign-In Button */}
          <div id="google-button" className="flex justify-center mb-6" />

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-[#1A1814]" />
            <span
              className="text-[#3D3D3D] text-xs uppercase tracking-wider"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Continue with
            </span>
            <div className="flex-1 h-px bg-[#1A1814]" />
          </div>

          {/* Sign Up Link */}
          <p
            className="text-center text-[#78716C] text-xs uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            No credentials?{" "}
            <Link
              to="/signup"
              className="text-[#D97706] hover:text-[#F59E0B] transition-colors font-medium"
            >
              Begin Trial
            </Link>
          </p>
        </div>

        {/* Back to Home */}
        <div className="text-center mt-10">
          <Link
            to="/"
            className="text-[#3D3D3D] hover:text-[#78716C] text-xs transition-colors inline-flex items-center gap-2 uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            <span>←</span> Return to Origin
          </Link>
        </div>
      </motion.div>
    </main>
  );
}
