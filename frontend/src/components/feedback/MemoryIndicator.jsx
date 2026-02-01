import { motion } from "framer-motion";

export default function MemoryIndicator({
  rag,
  variant = "inline",
  className = "",
}) {

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
        {}
        <span className="text-[#3B82F6] text-sm">💭</span>

        {}
        <span
          className="text-[#78716C] text-xs"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          Based on your past attempts
        </span>
      </motion.div>
    );
  }

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
