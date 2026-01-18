// src/components/admin/layout/AdminHeader.jsx
// Top navigation bar for admin panel - Arrakis Labs Dune theme
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../../context/AuthContext";

export default function AdminHeader() {
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const username = user?.email ? user.email.split("@")[0] : "admin";
  const displayName = user?.name || "Administrator";

  // Mock notifications - replace with real data
  const notifications = [
    {
      id: 1,
      type: "warning",
      message: "Judge worker-03 unresponsive",
      time: "5m ago",
    },
    {
      id: 2,
      type: "info",
      message: "New plagiarism case detected",
      time: "12m ago",
    },
    {
      id: 3,
      type: "success",
      message: "Contest #42 started successfully",
      time: "1h ago",
    },
  ];

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 border-b border-[#1A1814] h-14"
      style={{ backgroundColor: "#0A0A08" }}
    >
      <nav className="h-full px-6 flex items-center justify-between">
        {/* Brand */}
        <Link to="/admin" className="flex items-center gap-3">
          <div className="flex flex-col">
            <span
              className="text-[#E8E4D9] font-medium text-sm tracking-[0.2em] uppercase"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Arrakis
            </span>
            <span
              className="text-[#F59E0B] text-[10px] tracking-[0.3em] uppercase -mt-1"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Admin
            </span>
          </div>
        </Link>

        {/* Center - Quick Actions */}
        <div className="flex items-center gap-4">
          <Link
            to="/admin/problems/new"
            className="px-3 py-1.5 border border-[#1A1814] text-[#78716C] hover:text-[#E8E4D9] 
                       hover:border-[#78716C] transition-colors duration-200 text-xs uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            + Problem
          </Link>
          <Link
            to="/admin/contests/new"
            className="px-3 py-1.5 border border-[#1A1814] text-[#78716C] hover:text-[#E8E4D9] 
                       hover:border-[#78716C] transition-colors duration-200 text-xs uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            + Contest
          </Link>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          {/* View Site Link */}
          <a
            href="/problems"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#78716C] hover:text-[#E8E4D9] transition-colors text-xs uppercase tracking-wider"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            View Site ↗
          </a>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => {
                setNotificationsOpen(!notificationsOpen);
                setProfileOpen(false);
              }}
              className="relative p-2 text-[#78716C] hover:text-[#E8E4D9] transition-colors"
            >
              <span className="text-lg">⬡</span>
              {notifications.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-[#F59E0B]" />
              )}
            </button>

            {/* Notifications Dropdown */}
            <AnimatePresence>
              {notificationsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-72 border border-[#1A1814]"
                  style={{ backgroundColor: "#0D0D0B" }}
                >
                  <div className="px-4 py-2 border-b border-[#1A1814]">
                    <span
                      className="text-[#E8E4D9] text-xs uppercase tracking-wider"
                      style={{
                        fontFamily: "'Rajdhani', system-ui, sans-serif",
                      }}
                    >
                      Notifications
                    </span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className="px-4 py-3 border-b border-[#1A1814]/50 hover:bg-[#1A1814]/30 
                                   transition-colors cursor-pointer"
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className={`text-xs ${
                              notif.type === "warning"
                                ? "text-[#F59E0B]"
                                : notif.type === "success"
                                  ? "text-green-500"
                                  : "text-[#78716C]"
                            }`}
                          >
                            {notif.type === "warning"
                              ? "⚠"
                              : notif.type === "success"
                                ? "✓"
                                : "•"}
                          </span>
                          <div className="flex-1">
                            <p
                              className="text-[#E8E4D9] text-xs"
                              style={{
                                fontFamily: "'Rajdhani', system-ui, sans-serif",
                              }}
                            >
                              {notif.message}
                            </p>
                            <span
                              className="text-[#78716C] text-[10px] uppercase tracking-wider"
                              style={{
                                fontFamily: "'Rajdhani', system-ui, sans-serif",
                              }}
                            >
                              {notif.time}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Link
                    to="/admin/system/audit"
                    onClick={() => setNotificationsOpen(false)}
                    className="block px-4 py-2 text-center text-[#D97706] hover:text-[#F59E0B] 
                               text-xs uppercase tracking-wider transition-colors"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    View All
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setProfileOpen(!profileOpen);
                setNotificationsOpen(false);
              }}
              className="flex items-center gap-3 text-[#78716C] hover:text-[#E8E4D9] transition-colors"
            >
              <span
                className="text-xs tracking-[0.1em] uppercase"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                {username}
              </span>
              <div className="w-8 h-8 border border-[#1A1814] flex items-center justify-center">
                <span
                  className="text-[#F59E0B] text-xs uppercase"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  {displayName.charAt(0)}
                </span>
              </div>
            </button>

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
                      style={{
                        fontFamily: "'Rajdhani', system-ui, sans-serif",
                      }}
                    >
                      {displayName}
                    </p>
                    <p
                      className="text-[#F59E0B] text-[10px] uppercase tracking-wider mt-0.5"
                      style={{
                        fontFamily: "'Rajdhani', system-ui, sans-serif",
                      }}
                    >
                      Administrator
                    </p>
                  </div>
                  <Link
                    to="/admin/users/me"
                    onClick={() => setProfileOpen(false)}
                    className="block px-4 py-2 text-[#78716C] hover:text-[#E8E4D9] hover:bg-[#1A1814]/30 
                               transition-colors text-xs uppercase tracking-wider"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    My Profile
                  </Link>
                  <Link
                    to="/problems"
                    onClick={() => setProfileOpen(false)}
                    className="block px-4 py-2 text-[#78716C] hover:text-[#E8E4D9] hover:bg-[#1A1814]/30 
                               transition-colors text-xs uppercase tracking-wider"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    Exit Admin
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      setProfileOpen(false);
                      try {
                        await logout();
                      } finally {
                        navigate("/", { replace: true });
                      }
                    }}
                    className="block w-full text-left px-4 py-2 text-[#78716C] hover:text-[#92400E] 
                               hover:bg-[#92400E]/10 transition-colors text-xs uppercase tracking-wider"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    Sign Out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </nav>
    </header>
  );
}
