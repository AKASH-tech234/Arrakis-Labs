// src/components/feedback/AILoadingScreen.jsx
// Arrakis-themed animated loading component for AI feedback requests

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ═══════════════════════════════════════════════════════════════════════════════
// THEME CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const COLORS = {
  bg: "#0A0A08",
  bgCard: "#0F0F0D",
  border: "#1A1814",
  textPrimary: "#E8E4D9",
  textSecondary: "#A29A8C",
  textMuted: "#78716C",
  textDark: "#3D3D3D",
  accent: "#D97706",
};

const fontFamily = "'Rajdhani', 'Orbitron', system-ui, sans-serif";

// ═══════════════════════════════════════════════════════════════════════════════
// LOADING PHASES CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_PHASES = [
  { text: "Analyzing your approach...", icon: "⟡", duration: 2000 },
  { text: "Identifying patterns...", icon: "◈", duration: 2000 },
  { text: "Evaluating code quality...", icon: "◇", duration: 2000 },
  { text: "Building your learning plan...", icon: "✦", duration: 2000 },
];

const QUICK_PHASES = [
  { text: "Thinking...", icon: "◈", duration: 1500 },
  { text: "Preparing hint...", icon: "✧", duration: 1500 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SPINNER COMPONENT - ARRAKIS STYLE
// ═══════════════════════════════════════════════════════════════════════════════

function ArrakisSpinner({ size = "medium" }) {
  const sizeClasses = {
    small: "w-8 h-8",
    medium: "w-12 h-12",
    large: "w-16 h-16",
  };

  return (
    <div className={`relative ${sizeClasses[size]}`}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 border-2 rounded-full"
        style={{
          borderColor: `${COLORS.accent}30`,
          borderTopColor: COLORS.accent,
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRESS DOTS
// ═══════════════════════════════════════════════════════════════════════════════

function ProgressDots({ phases, currentPhase }) {
  return (
    <div className="flex gap-2 mt-6">
      {phases.map((_, idx) => (
        <motion.div
          key={idx}
          animate={{
            scale: idx === currentPhase ? 1.3 : 1,
            backgroundColor:
              idx === currentPhase
                ? COLORS.accent
                : idx < currentPhase
                  ? COLORS.textMuted
                  : COLORS.textDark,
          }}
          className="w-1.5 h-1.5 rounded-full"
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function AILoadingScreen({
  variant = "full", // "full" | "compact" | "inline"
  phases = DEFAULT_PHASES,
  showSpinner = true,
  showProgress = true,
  subtitle = "Preparing personalized feedback...",
}) {
  const [currentPhase, setCurrentPhase] = useState(0);

  useEffect(() => {
    const currentPhaseDuration = phases[currentPhase]?.duration || 2000;

    const timer = setTimeout(() => {
      setCurrentPhase((prev) => (prev + 1) % phases.length);
    }, currentPhaseDuration);

    return () => clearTimeout(timer);
  }, [currentPhase, phases]);

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPACT VARIANT (for panels)
  // ═══════════════════════════════════════════════════════════════════════════

  if (variant === "compact") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex flex-col items-center py-8"
      >
        <ArrakisSpinner size="small" />
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPhase}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="flex items-center gap-2 mt-4"
          >
            <span style={{ color: COLORS.accent }}>
              {phases[currentPhase].icon}
            </span>
            <span
              className="text-xs uppercase tracking-wider"
              style={{ color: COLORS.textSecondary, fontFamily }}
            >
              {phases[currentPhase].text}
            </span>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INLINE VARIANT (for buttons/small spaces)
  // ═══════════════════════════════════════════════════════════════════════════

  if (variant === "inline") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="inline-flex items-center gap-2"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          className="w-4 h-4 border-2 rounded-full"
          style={{
            borderColor: `${COLORS.accent}30`,
            borderTopColor: COLORS.accent,
          }}
        />
        <span
          className="text-xs uppercase tracking-wider"
          style={{ color: COLORS.textSecondary, fontFamily }}
        >
          {phases[currentPhase].text}
        </span>
      </motion.div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FULL VARIANT (default, for pages)
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center py-16"
    >
      {/* Loading spinner */}
      {showSpinner && (
        <div className="mb-8">
          <ArrakisSpinner size="large" />
        </div>
      )}

      {/* Phase text with animation */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPhase}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-3"
        >
          <motion.span
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.5 }}
            style={{ color: COLORS.accent }}
            className="text-xl"
          >
            {phases[currentPhase].icon}
          </motion.span>
          <span
            className="text-sm uppercase tracking-wider"
            style={{ color: COLORS.textSecondary, fontFamily }}
          >
            {phases[currentPhase].text}
          </span>
        </motion.div>
      </AnimatePresence>

      {/* Progress dots */}
      {showProgress && (
        <ProgressDots phases={phases} currentPhase={currentPhase} />
      )}

      {/* Subtitle */}
      {subtitle && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-xs mt-8 text-center max-w-md uppercase tracking-wider"
          style={{ color: COLORS.textDark, fontFamily }}
        >
          {subtitle}
        </motion.p>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUICK LOADING (for hints)
// ═══════════════════════════════════════════════════════════════════════════════

export function AIQuickLoading() {
  return (
    <AILoadingScreen
      variant="compact"
      phases={QUICK_PHASES}
      showProgress={false}
      subtitle={null}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// OVERLAY LOADING (for modals)
// ═══════════════════════════════════════════════════════════════════════════════

export function AILoadingOverlay({ isVisible }) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: `${COLORS.bg}E6` }}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            className="border rounded-xl p-8"
            style={{
              backgroundColor: COLORS.bgCard,
              borderColor: COLORS.border,
            }}
          >
            <AILoadingScreen variant="full" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
