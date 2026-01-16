// src/pages/Signup.jsx - Dune-Inspired
import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import ArrakisLogo from "../components/ui/ArrakisLogo";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    // No backend logic - UI only
    console.log("Signup submitted:", { name, email, password });
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6 py-12"
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

        {/* Signup Card - Angular, no rounded corners */}
        <div
          className="border border-[#1A1814] p-8 md:p-10"
          style={{ backgroundColor: "#0D0D0B" }}
        >
          <h2
            className="text-xl font-medium text-[#E8E4D9] mb-2 text-center uppercase tracking-[0.15em]"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Begin Your Trial
          </h2>
          <p
            className="text-[#78716C] text-center mb-8 text-xs tracking-wider uppercase"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Register to enter the system
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-[#78716C] text-xs mb-2 uppercase tracking-wider"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Designation
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#0A0A08] border border-[#1A1814] text-[#E8E4D9] px-4 py-3 text-sm
                         focus:outline-none focus:border-[#92400E]/50 transition-all duration-200
                         placeholder:text-[#3D3D3D]"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                placeholder="Your designation"
              />
            </div>

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

            {/* Submit */}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-[#92400E] to-[#D97706] text-[#0A0A08] py-3.5 font-semibold text-xs tracking-[0.15em] uppercase
                       hover:from-[#D97706] hover:to-[#F59E0B] transition-all duration-300"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Initialize Trial
            </button>
          </form>

          {/* Terms */}
          <p
            className="text-[#3D3D3D] text-xs text-center mt-6 leading-relaxed"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            By registering, you accept the{" "}
            <a href="#" className="text-[#D97706] hover:text-[#F59E0B]">
              Protocols
            </a>{" "}
            and{" "}
            <a href="#" className="text-[#D97706] hover:text-[#F59E0B]">
              Data Covenant
            </a>
          </p>

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

          {/* Login Link */}
          <p
            className="text-center text-[#78716C] text-xs uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Already registered?{" "}
            <Link
              to="/login"
              className="text-[#D97706] hover:text-[#F59E0B] transition-colors font-medium"
            >
              Authenticate
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
