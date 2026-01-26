

import React from "react";
import { motion } from "framer-motion";

export default function ArrakisLogo({
  size = "md",
  showWordmark = true,
  className = "",
  animated = true,
}) {
  const sizes = {
    sm: { symbol: 32, text: "text-xs", spacing: "tracking-[0.2em]" },
    md: { symbol: 48, text: "text-sm", spacing: "tracking-[0.25em]" },
    lg: { symbol: 64, text: "text-base", spacing: "tracking-[0.3em]" },
    xl: { symbol: 96, text: "text-lg", spacing: "tracking-[0.35em]" },
  };

  const config = sizes[size] || sizes.md;

  const symbolVariants = {
    initial: { opacity: 0, y: 10 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: "easeOut" },
    },
  };

  const lineVariants = {
    initial: { pathLength: 0, opacity: 0 },
    animate: (i) => ({
      pathLength: 1,
      opacity: 1,
      transition: {
        pathLength: { duration: 1.2, delay: i * 0.15, ease: "easeOut" },
        opacity: { duration: 0.3, delay: i * 0.15 },
      },
    }),
  };

  const glowVariants = {
    animate: {
      opacity: [0.3, 0.6, 0.3],
      transition: { duration: 4, repeat: Infinity, ease: "easeInOut" },
    },
  };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {}
      <motion.div
        variants={animated ? symbolVariants : undefined}
        initial={animated ? "initial" : undefined}
        animate={animated ? "animate" : undefined}
        className="relative"
        style={{ width: config.symbol, height: config.symbol }}
      >
        {}
        {animated && (
          <motion.div
            variants={glowVariants}
            animate="animate"
            className="absolute inset-0 blur-xl"
            style={{
              background:
                "radial-gradient(circle, rgba(245, 158, 11, 0.4) 0%, transparent 70%)",
            }}
          />
        )}

        <svg
          viewBox="0 0 100 100"
          fill="none"
          className="w-full h-full relative z-10"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient
              id="arrakis-gradient"
              x1="0%"
              y1="100%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor="#92400E" />
              <stop offset="50%" stopColor="#D97706" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
            <filter id="arrakis-glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {}
          <motion.path
            d="M 25 75 L 45 25"
            stroke="url(#arrakis-gradient)"
            strokeWidth="3"
            strokeLinecap="square"
            filter="url(#arrakis-glow)"
            variants={animated ? lineVariants : undefined}
            initial={animated ? "initial" : undefined}
            animate={animated ? "animate" : undefined}
            custom={0}
          />

          {}
          <motion.path
            d="M 50 80 L 50 20"
            stroke="url(#arrakis-gradient)"
            strokeWidth="4"
            strokeLinecap="square"
            filter="url(#arrakis-glow)"
            variants={animated ? lineVariants : undefined}
            initial={animated ? "initial" : undefined}
            animate={animated ? "animate" : undefined}
            custom={1}
          />

          {}
          <motion.path
            d="M 75 75 L 55 25"
            stroke="url(#arrakis-gradient)"
            strokeWidth="3"
            strokeLinecap="square"
            filter="url(#arrakis-glow)"
            variants={animated ? lineVariants : undefined}
            initial={animated ? "initial" : undefined}
            animate={animated ? "animate" : undefined}
            custom={2}
          />

          {}
          <motion.path
            d="M 15 82 L 85 82"
            stroke="url(#arrakis-gradient)"
            strokeWidth="1.5"
            strokeLinecap="square"
            opacity="0.6"
            variants={animated ? lineVariants : undefined}
            initial={animated ? "initial" : undefined}
            animate={animated ? "animate" : undefined}
            custom={3}
          />

          {}
          <motion.circle
            cx="50"
            cy="18"
            r="2"
            fill="#F59E0B"
            initial={animated ? { opacity: 0, scale: 0 } : undefined}
            animate={
              animated
                ? {
                    opacity: [0.5, 1, 0.5],
                    scale: 1,
                    transition: {
                      opacity: {
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      },
                      scale: { duration: 0.5, delay: 1.5 },
                    },
                  }
                : undefined
            }
          />
        </svg>
      </motion.div>

      {}
      {showWordmark && (
        <motion.div
          initial={animated ? { opacity: 0, y: 5 } : undefined}
          animate={animated ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.6, delay: 1.2 }}
          className="mt-3 text-center"
        >
          <span
            className={`block font-medium text-[#E8E4D9] ${config.text} ${config.spacing} uppercase`}
            style={{ fontFamily: "'Rajdhani', 'Orbitron', sans-serif" }}
          >
            Arrakis Labs
          </span>
        </motion.div>
      )}
    </div>
  );
}
