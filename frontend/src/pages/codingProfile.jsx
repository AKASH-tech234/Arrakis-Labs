// src/pages/codingProfile.jsx - Coding Profile Page
import { motion } from "framer-motion";
import AppHeader from "../components/layout/AppHeader";

export default function CodingProfile() {
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: "#0A0A08" }}>
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Top right glow */}
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#D97706]/5 rounded-full blur-3xl"></div>
        {/* Bottom left glow */}
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#92400E]/5 rounded-full blur-3xl"></div>
        {/* Center accent */}
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-[#D97706]/3 rounded-full blur-3xl"></div>
      </div>

      {/* Grid Pattern Overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-5"
        style={{
          backgroundImage: `linear-gradient(to right, #D97706 1px, transparent 1px), linear-gradient(to bottom, #D97706 1px, transparent 1px)`,
          backgroundSize: "50px 50px",
        }}
      ></div>

      <AppHeader />

      <main className="pt-20 relative z-10">
        <div className="max-w-5xl mx-auto px-6 lg:px-12 py-12">
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="mb-16"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-6 bg-gradient-to-b from-[#D97706] to-transparent rounded-full"></div>
              <h2
                className="text-[#E8E4D9] text-sm font-medium uppercase tracking-widest"
                style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
              >
                Coding Profile
              </h2>
            </div>

            <div className="relative bg-gradient-to-br from-[#1A1814]/50 to-[#0A0A08]/50 backdrop-blur-sm border border-[#D97706]/20 rounded-xl p-8">
              <button
                type="button"
                className="px-3 py-2 text-sm rounded-md bg-[#D97706] hover:bg-[#F59E0B] text-black font-semibold transition-colors"
              >
                Add Profile
              </button>
            </div>
          </motion.section>
        </div>
      </main>
    </div>
  );
}
