// src/components/layout/AppHeader.jsx
// Persistent header for authenticated pages (Problems, Profile)
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

// Mock user data
const mockUser = {
  name: "Paul Atreides",
  username: "muaddib",
};

export default function AppHeader() {
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 border-b border-[#1A1814]"
      style={{ backgroundColor: "#0A0A08" }}
    >
      <nav className="max-w-7xl mx-auto px-6 lg:px-12 h-14 flex items-center justify-between">
        {/* Brand */}
        <Link to="/problems" className="flex items-center gap-3">
          <div className="flex flex-col">
            <span
              className="text-[#E8E4D9] font-medium text-sm tracking-[0.2em] uppercase"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Mentat Trials
            </span>
          </div>
        </Link>

        {/* Center Navigation */}
        <div className="flex items-center gap-8">
          <Link
            to="/problems"
            className={`text-xs tracking-[0.1em] uppercase transition-colors duration-200 ${
              isActive("/problems")
                ? "text-[#E8E4D9]"
                : "text-[#78716C] hover:text-[#E8E4D9]"
            }`}
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Problems
          </Link>
        </div>

        {/* Profile Section */}
        <div className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-3 text-[#78716C] hover:text-[#E8E4D9] transition-colors duration-200"
          >
            <span
              className="text-xs tracking-[0.1em] uppercase"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {mockUser.username}
            </span>
            <div className="w-8 h-8 border border-[#1A1814] flex items-center justify-center">
              <span
                className="text-[#78716C] text-xs uppercase"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                {mockUser.name.charAt(0)}
              </span>
            </div>
          </button>

          {/* Profile Dropdown */}
          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-48 border border-[#1A1814] py-2"
                style={{ backgroundColor: "#0D0D0B" }}
              >
                <div className="px-4 py-2 border-b border-[#1A1814]">
                  <p
                    className="text-[#E8E4D9] text-xs uppercase tracking-wider"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    {mockUser.name}
                  </p>
                  <p
                    className="text-[#78716C] text-[10px] uppercase tracking-wider mt-0.5"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    @{mockUser.username}
                  </p>
                </div>
                <Link
                  to="/profile"
                  onClick={() => setProfileOpen(false)}
                  className="block px-4 py-2 text-[#78716C] hover:text-[#E8E4D9] hover:bg-[#1A1814]/30 transition-colors text-xs uppercase tracking-wider"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  View Profile
                </Link>
                <Link
                  to="/"
                  onClick={() => setProfileOpen(false)}
                  className="block px-4 py-2 text-[#78716C] hover:text-[#E8E4D9] hover:bg-[#1A1814]/30 transition-colors text-xs uppercase tracking-wider"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  Sign Out
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>
    </header>
  );
}
