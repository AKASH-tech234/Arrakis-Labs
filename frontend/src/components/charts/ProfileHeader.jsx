// src/components/charts/ProfileHeader.jsx
// User profile header with minimal info
import { motion } from "framer-motion";

export default function ProfileHeader({ user }) {
  const name = user?.name || "—";
  const username = user?.username || "—";
  const descriptor = user?.descriptor || "—";
  const memberSince = user?.memberSince || "—";

  return (
    <div className="flex items-start gap-8">
      {/* Avatar */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="group relative flex-shrink-0"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#D97706] to-[#92400E] rounded-lg opacity-0 group-hover:opacity-100 blur transition-opacity duration-300"></div>
        <div className="relative w-24 h-24 border-2 border-[#D97706]/50 group-hover:border-[#D97706] rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-[#1A1814] to-[#0A0A08] group-hover:from-[#2A2416] group-hover:to-[#1A1814] transition-all duration-300">
          <motion.span
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="text-4xl font-bold uppercase bg-gradient-to-r from-[#D97706] to-[#F59E0B] bg-clip-text text-transparent"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {String(name).charAt(0) || "?"}
          </motion.span>
        </div>
      </motion.div>

      {/* User Info */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="space-y-4 flex-1"
      >
        <div>
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-3xl font-bold tracking-wide bg-gradient-to-r from-[#E8E4D9] to-[#F59E0B] bg-clip-text text-transparent"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {name}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-[#D97706] text-sm uppercase tracking-widest font-medium mt-1"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            @{username}
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex items-center gap-4 pt-2 border-t border-[#D97706]/20"
        >
          <div className="flex flex-col">
            <p
              className="text-[#78716C] text-xs uppercase tracking-wider mb-1"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Status
            </p>
            <p
              className="text-[#F59E0B] font-medium italic tracking-wide"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {descriptor}
            </p>
          </div>

          <div className="w-px h-12 bg-gradient-to-b from-[#D97706]/30 to-transparent"></div>

          <div className="flex flex-col">
            <p
              className="text-[#78716C] text-xs uppercase tracking-wider mb-1"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Member Since
            </p>
            <p
              className="text-[#E8E4D9] font-medium"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {memberSince}
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
