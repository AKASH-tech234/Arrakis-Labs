// Arrakis Labs - Features Section
// Dune-inspired neural constellation with floating nodes and animated connections

import React, { useRef } from "react";
import { motion, useInView } from "framer-motion";
import ArrakisLogo from "./ArrakisLogo";

// Node data - DO NOT RENAME these labels
const sourceNodes = [
  { id: "memory", label: "Memory", x: 15, y: 12 },
  { id: "adapt", label: "Adapt", x: 38, y: 8 },
  { id: "secure", label: "Secure", x: 62, y: 8 },
  { id: "analytics", label: "Analytics", x: 85, y: 12 },
];

const centralNode = {
  id: "central",
  label: "AI-Powered Learning Intelligence",
  x: 50,
  y: 45,
};

const outputNodes = [
  { id: "memory-ai", label: "Memory AI", x: 32, y: 72 },
  { id: "feedback", label: "Real-time Feedback", x: 68, y: 72 },
];

// Floating animation for nodes
const floatAnimation = (index) => ({
  y: [0, -6, 0, 4, 0],
  x: [0, 2, -1.5, 1, 0],
  transition: {
    duration: 6 + index * 0.8,
    repeat: Infinity,
    ease: "easeInOut",
    times: [0, 0.25, 0.5, 0.75, 1],
  },
});

// Glow pulse animation
const glowPulse = {
  opacity: [0.4, 0.7, 0.4],
  scale: [1, 1.15, 1],
  transition: {
    duration: 3.5,
    repeat: Infinity,
    ease: "easeInOut",
  },
};

// Connection path generator
const getConnectionPath = (from, to, curveOffset = 0) => {
  const midY = (from.y + to.y) / 2 + curveOffset;
  return `M ${from.x} ${from.y} Q ${from.x + (to.x - from.x) * 0.3} ${midY}, ${
    to.x
  } ${to.y}`;
};

// Energy particle component
const EnergyParticle = ({ pathData, delay, duration, index }) => {
  return (
    <motion.circle
      r="0.8"
      fill="#F59E0B"
      filter="url(#particle-glow)"
      initial={{ offsetDistance: "0%", opacity: 0 }}
      animate={{
        offsetDistance: ["0%", "100%"],
        opacity: [0, 1, 1, 0],
      }}
      transition={{
        duration: duration,
        delay: delay,
        repeat: Infinity,
        ease: "linear",
        times: [0, 0.1, 0.9, 1],
      }}
      style={{
        offsetPath: `path("${pathData}")`,
        offsetRotate: "0deg",
      }}
    />
  );
};

// Feature Node component
const FeatureNode = ({ node, type, index, isInView }) => {
  const sizes = {
    source: { glow: 8, inner: 1.5, fontSize: 2.2 },
    central: { glow: 14, inner: 3, fontSize: 1.8 },
    output: { glow: 10, inner: 2, fontSize: 2 },
  };

  const config = sizes[type];

  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.3 }}
      animate={isInView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.8, delay: index * 0.12 + 0.3 }}
    >
      {/* Outer glow */}
      <motion.circle
        cx={node.x}
        cy={node.y}
        r={config.glow}
        fill="url(#node-glow-gradient)"
        animate={glowPulse}
        style={{ filter: "blur(3px)" }}
      />

      {/* Inner core ring */}
      <motion.circle
        cx={node.x}
        cy={node.y}
        r={config.inner}
        fill="transparent"
        stroke="url(#amber-gradient)"
        strokeWidth="0.25"
        animate={floatAnimation(index)}
      />

      {/* Center dot */}
      <motion.circle
        cx={node.x}
        cy={node.y}
        r={config.inner * 0.4}
        fill="#F59E0B"
        animate={{
          opacity: [0.6, 1, 0.6],
          scale: [1, 1.2, 1],
          ...floatAnimation(index),
        }}
        transition={{
          opacity: { duration: 2, repeat: Infinity, ease: "easeInOut" },
          scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
        }}
      />

      {/* Label */}
      <motion.text
        x={node.x}
        y={
          type === "central"
            ? node.y + 7
            : node.y + (type === "source" ? -4 : 5)
        }
        textAnchor="middle"
        fill="#E8E4D9"
        fontSize={config.fontSize}
        fontWeight="500"
        letterSpacing="0.12em"
        style={{
          fontFamily: "'Rajdhani', 'Orbitron', system-ui, sans-serif",
          textTransform: "uppercase",
        }}
        animate={floatAnimation(index)}
      >
        {node.label}
      </motion.text>
    </motion.g>
  );
};

// Central node concentric rings
const CentralNodeRings = ({ node, isInView }) => {
  return (
    <g>
      {[0, 1, 2].map((ringIndex) => (
        <motion.circle
          key={ringIndex}
          cx={node.x}
          cy={node.y}
          r={4}
          fill="none"
          stroke="#D97706"
          strokeWidth="0.15"
          initial={{ scale: 1, opacity: 0.5 }}
          animate={
            isInView
              ? {
                  scale: [1, 3.5],
                  opacity: [0.5, 0],
                }
              : {}
          }
          transition={{
            duration: 4,
            delay: ringIndex * 1.3 + 1,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      ))}
    </g>
  );
};

// Connection line with energy flow
const ConnectionLine = ({ from, to, index, isInView, curveOffset = 0 }) => {
  const pathData = getConnectionPath(from, to, curveOffset);

  return (
    <g>
      {/* Base connection line */}
      <motion.path
        d={pathData}
        fill="none"
        stroke="#D97706"
        strokeWidth="0.12"
        strokeOpacity="0.35"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={isInView ? { pathLength: 1, opacity: 1 } : {}}
        transition={{ duration: 1.5, delay: index * 0.1, ease: "easeOut" }}
      />

      {/* Energy particles */}
      {isInView && (
        <>
          <EnergyParticle
            pathData={pathData}
            delay={index * 0.4 + 1}
            duration={2.8}
            index={0}
          />
          <EnergyParticle
            pathData={pathData}
            delay={index * 0.4 + 2.4}
            duration={2.8}
            index={1}
          />
        </>
      )}
    </g>
  );
};

export default function Features() {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });

  return (
    <section
      id="features"
      ref={containerRef}
      className="relative min-h-screen py-20 md:py-28 overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse 100% 80% at 50% 120%, rgba(217, 119, 6, 0.06) 0%, rgba(146, 64, 14, 0.03) 35%, transparent 65%),
          linear-gradient(to bottom, #0A0A08 0%, #0A0A08 100%)
        `,
      }}
    >
      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8 }}
        className="text-center mb-12 md:mb-16 px-6"
      >
        <h2
          className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-medium mb-4"
          style={{
            fontFamily: "'Rajdhani', 'Orbitron', system-ui, sans-serif",
            letterSpacing: "0.2em",
            color: "#E8E4D9",
            textTransform: "uppercase",
            textShadow: "0 0 40px rgba(245, 158, 11, 0.15)",
          }}
        >
          Neural Architecture
        </h2>
        <p
          className="text-xs sm:text-sm md:text-base max-w-xl mx-auto"
          style={{
            fontFamily: "'Rajdhani', 'Orbitron', system-ui, sans-serif",
            letterSpacing: "0.15em",
            color: "#78716C",
            textTransform: "uppercase",
          }}
        >
          Intelligence systems born of desert silence
        </p>
      </motion.div>

      {/* Neural Constellation SVG */}
      <div className="relative max-w-4xl mx-auto px-6">
        <svg
          viewBox="0 0 100 95"
          className="w-full h-auto"
          style={{ maxHeight: "65vh" }}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Amber gradient */}
            <linearGradient
              id="amber-gradient"
              x1="0%"
              y1="100%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor="#92400E" />
              <stop offset="50%" stopColor="#D97706" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>

            {/* Node glow gradient */}
            <radialGradient id="node-glow-gradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.5" />
              <stop offset="50%" stopColor="#D97706" stopOpacity="0.2" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </radialGradient>

            {/* Particle glow filter */}
            <filter
              id="particle-glow"
              x="-100%"
              y="-100%"
              width="300%"
              height="300%"
            >
              <feGaussianBlur stdDeviation="0.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Connection lines: source → central */}
          {sourceNodes.map((node, index) => (
            <ConnectionLine
              key={`src-${node.id}`}
              from={node}
              to={centralNode}
              index={index}
              isInView={isInView}
              curveOffset={index % 2 === 0 ? -4 : 4}
            />
          ))}

          {/* Connection lines: central → output */}
          {outputNodes.map((node, index) => (
            <ConnectionLine
              key={`out-${node.id}`}
              from={centralNode}
              to={node}
              index={index + 4}
              isInView={isInView}
              curveOffset={index === 0 ? 3 : -3}
            />
          ))}

          {/* Connection lines: output → logo anchor */}
          <ConnectionLine
            from={outputNodes[0]}
            to={{ x: 50, y: 88 }}
            index={6}
            isInView={isInView}
            curveOffset={2}
          />
          <ConnectionLine
            from={outputNodes[1]}
            to={{ x: 50, y: 88 }}
            index={7}
            isInView={isInView}
            curveOffset={-2}
          />

          {/* Central node expanding rings */}
          <CentralNodeRings node={centralNode} isInView={isInView} />

          {/* Source nodes */}
          {sourceNodes.map((node, index) => (
            <FeatureNode
              key={node.id}
              node={node}
              type="source"
              index={index}
              isInView={isInView}
            />
          ))}

          {/* Central node */}
          <FeatureNode
            node={centralNode}
            type="central"
            index={4}
            isInView={isInView}
          />

          {/* Output nodes */}
          {outputNodes.map((node, index) => (
            <FeatureNode
              key={node.id}
              node={node}
              type="output"
              index={index + 5}
              isInView={isInView}
            />
          ))}
        </svg>

        {/* Logo anchor at bottom */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 1.8 }}
          className="flex justify-center mt-4"
        >
          <ArrakisLogo size="md" showWordmark={false} animated={isInView} />
        </motion.div>
      </div>
    </section>
  );
}
