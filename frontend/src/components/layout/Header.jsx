// src/components/layout/Header.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import ArrakisLogo from "../ui/ArrakisLogo";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#0A0A08]/95 backdrop-blur-md border-b border-[#92400E]/20"
          : "bg-transparent"
      }`}
    >
      <nav className="max-w-7xl mx-auto px-6 lg:px-12 py-4 flex items-center justify-between">
        {/* Brand with New Arrakis Logo */}
        <Link to="/" className="flex items-center gap-3">
          <ArrakisLogo size="sm" showWordmark={false} animated={false} />
          <div className="flex flex-col">
            <span
              className="text-[#E8E4D9] font-medium text-sm tracking-[0.2em] uppercase"
              style={{
                fontFamily: "'Rajdhani', 'Orbitron', system-ui, sans-serif",
              }}
            >
              Arrakis Labs
            </span>
            <span
              className="text-[#78716C] text-[10px] tracking-[0.15em] uppercase"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Mentat Trials
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center gap-8">
          <a
            href="#features"
            className="text-[#78716C] hover:text-[#E8E4D9] transition-colors duration-200 text-xs tracking-[0.1em] uppercase"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="text-[#78716C] hover:text-[#E8E4D9] transition-colors duration-200 text-xs tracking-[0.1em] uppercase"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Process
          </a>
          <a
            href="#pricing"
            className="text-[#78716C] hover:text-[#E8E4D9] transition-colors duration-200 text-xs tracking-[0.1em] uppercase"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Access
          </a>
        </div>

        {/* Auth Buttons */}
        <div className="flex items-center gap-4">
          <Link
            to="/login"
            className="text-[#78716C] hover:text-[#E8E4D9] transition-colors duration-200 text-xs tracking-[0.1em] uppercase font-medium"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Enter
          </Link>
          <Link
            to="/signup"
            className="px-5 py-2 bg-gradient-to-r from-[#92400E] to-[#D97706] text-[#0A0A08] font-semibold text-xs tracking-[0.1em] uppercase
                     hover:from-[#D97706] hover:to-[#F59E0B] transition-all duration-300"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Begin Trial
          </Link>
        </div>
      </nav>
    </motion.header>
  );
}
