// ═══════════════════════════════════════════════════════════════════════════════
// MEMORY INDICATOR (RAG Usage)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Subtle indicator that RAG (Retrieval-Augmented Generation) was used.
//
// UI RULES:
// - Only show if rag.used === true
// - Display subtle text: "Based on your past attempts"
// - NEVER show raw memory text or relevance score to user
// - Keep it subtle and non-distracting
//
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from "framer-motion";

/**
 * MemoryIndicator - Shows subtle indicator that past attempts influenced feedback
 *
 * @param {Object} props
 * @param {Object} props.rag - RAG metadata from API
 * @param {boolean} props.rag.used - Whether RAG was used
 * @param {number} [props.rag.relevance] - Relevance score (not shown to user)
 * @param {"inline" | "block"} [props.variant] - Display variant
 * @param {string} [props.className] - Additional CSS classes
 */
export default function MemoryIndicator({
  rag,
  variant = "inline",
  className = "",
}) {
  // Only show if RAG was actually used
  if (!rag?.used) {
    return null;
  }

  if (variant === "block") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-[#3B82F6]/5 border border-[#3B82F6]/10 ${className}`}
      >
        {/* Memory icon */}
        <span className="text-[#3B82F6] text-sm">💭</span>

        {/* Text */}
        <span
          className="text-[#78716C] text-xs"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          Based on your past attempts
        </span>
      </motion.div>
    );
  }

  // Inline variant (default)
  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className={`inline-flex items-center gap-1.5 text-[#78716C] text-xs ${className}`}
      style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
    >
      <span className="text-[#3B82F6]">💭</span>
      <span>Based on your past attempts</span>
    </motion.span>
  );
}

/**
 * Compact dot indicator for tight spaces
 */
export function MemoryDot({ rag, className = "" }) {
  if (!rag?.used) {
    return null;
  }

  return (
    <span
      className={`inline-block w-2 h-2 rounded-full bg-[#3B82F6] ${className}`}
      title="Feedback informed by your past attempts"
    />
  );
}

/**
 * Icon-only indicator
 */
export function MemoryIcon({ rag, className = "" }) {
  if (!rag?.used) {
    return null;
  }

  return (
    <span
      className={`text-[#3B82F6] ${className}`}
      title="Feedback informed by your past attempts"
    >
      💭
    </span>
  );
}
