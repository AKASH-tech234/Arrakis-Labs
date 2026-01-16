// src/components/landing/HowItWorks.jsx - Dune-Inspired
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const steps = [
  {
    number: "I",
    title: "Select Your Trial",
    description:
      "Navigate curated challenges aligned to your skill horizon. The system reads your history and surfaces the next worthy test.",
  },
  {
    number: "II",
    title: "Compose Your Solution",
    description:
      "Write in an environment of silence and focus. Syntax flows, errors surface, and your mind remains undisturbed.",
  },
  {
    number: "III",
    title: "Receive Guidance",
    description:
      "The AI does not judge—it teaches. Detailed feedback reveals not just what, but why. Understanding deepens.",
  },
  {
    number: "IV",
    title: "Witness Evolution",
    description:
      "Track your transformation over time. See patterns emerge, strengths solidify, and mastery approach.",
  },
];

function StepCard({ step, index }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.5, delay: index * 0.15, ease: "easeOut" }}
      className="relative"
    >
      {/* Connector line */}
      {index < steps.length - 1 && (
        <div className="hidden lg:block absolute top-6 left-[calc(100%+8px)] w-[calc(100%-16px)] h-px bg-gradient-to-r from-[#92400E]/40 to-transparent" />
      )}

      <div className="relative">
        {/* Step number - Angular, no rounded corners */}
        <div
          className="w-12 h-12 bg-gradient-to-br from-[#92400E] to-[#D97706] flex items-center justify-center mb-6"
          style={{
            clipPath: "polygon(0 0, 100% 0, 100% 85%, 85% 100%, 0 100%)",
          }}
        >
          <span
            className="text-[#0A0A08] font-semibold text-sm tracking-wider"
            style={{
              fontFamily: "'Orbitron', 'Rajdhani', system-ui, sans-serif",
            }}
          >
            {step.number}
          </span>
        </div>

        <h3
          className="text-lg font-medium text-[#E8E4D9] mb-3 tracking-wide uppercase"
          style={{
            fontFamily: "'Rajdhani', system-ui, sans-serif",
            letterSpacing: "0.1em",
          }}
        >
          {step.title}
        </h3>
        <p
          className="text-[#78716C] leading-relaxed text-sm"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          {step.description}
        </p>
      </div>
    </motion.div>
  );
}

export default function HowItWorks() {
  const headerRef = useRef(null);
  const headerInView = useInView(headerRef, { once: true, margin: "-50px" });

  return (
    <section
      id="how-it-works"
      className="py-24 md:py-32"
      style={{ backgroundColor: "#0A0A08" }}
    >
      <div className="max-w-6xl mx-auto px-6 lg:px-12">
        {/* Section Header */}
        <motion.div
          ref={headerRef}
          initial={{ opacity: 0, y: 20 }}
          animate={headerInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center mb-16"
        >
          <span
            className="inline-block px-5 py-2 border border-[#92400E]/30 text-[#D97706] text-xs tracking-[0.2em] uppercase mb-8"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            The Process
          </span>
          <h2
            className="text-3xl md:text-4xl lg:text-5xl font-medium text-[#E8E4D9] mb-6"
            style={{
              fontFamily: "'Orbitron', 'Rajdhani', system-ui, sans-serif",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              textShadow: "0 0 40px rgba(245, 158, 11, 0.1)",
            }}
          >
            The Path to Mastery
          </h2>
          <p
            className="text-[#78716C] max-w-2xl mx-auto text-base"
            style={{
              fontFamily: "'Rajdhani', system-ui, sans-serif",
              letterSpacing: "0.05em",
            }}
          >
            Four phases of deliberate cultivation. Each step builds upon the
            last, guided by memory and adapted to your unique pattern of growth.
          </p>
        </motion.div>

        {/* Steps Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10 md:gap-8">
          {steps.map((step, index) => (
            <StepCard key={step.number} step={step} index={index} />
          ))}
        </div>

        {/* Code Preview - Dune themed terminal */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-20"
        >
          <div
            className="border border-[#1A1814] overflow-hidden"
            style={{ backgroundColor: "#0D0D0B" }}
          >
            {/* Editor header - angular, minimal */}
            <div className="px-5 py-3 border-b border-[#1A1814] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-[#92400E]" />
                <div className="w-2 h-2 bg-[#D97706]" />
                <div className="w-2 h-2 bg-[#F59E0B]" />
              </div>
              <span
                className="text-[#78716C] text-xs tracking-[0.15em] uppercase"
                style={{ fontFamily: "'Rajdhani', monospace" }}
              >
                solution.mentat
              </span>
            </div>

            {/* Code content */}
            <div className="p-6 font-mono text-sm leading-relaxed">
              <div className="flex gap-6">
                {/* Line numbers */}
                <div
                  className="text-[#3D3D3D] select-none text-right"
                  style={{ minWidth: "24px" }}
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <div key={n}>{n}</div>
                  ))}
                </div>
                {/* Code */}
                <div>
                  <div>
                    <span className="text-[#92400E]">def</span>{" "}
                    <span className="text-[#F59E0B]">fibonacci</span>
                    <span className="text-[#E8E4D9]">(n):</span>
                  </div>
                  <div>
                    <span className="text-[#5C5C5C]">
                      {" "}
                      # MENTAT: Consider memoization for efficiency
                    </span>
                  </div>
                  <div>
                    <span className="text-[#92400E]"> if</span>{" "}
                    <span className="text-[#E8E4D9]">n &lt;= </span>
                    <span className="text-[#D97706]">1</span>
                    <span className="text-[#E8E4D9]">:</span>
                  </div>
                  <div>
                    <span className="text-[#92400E]"> return</span>{" "}
                    <span className="text-[#E8E4D9]">n</span>
                  </div>
                  <div>
                    <span className="text-[#92400E]"> return</span>{" "}
                    <span className="text-[#F59E0B]">fibonacci</span>
                    <span className="text-[#E8E4D9]">(n-</span>
                    <span className="text-[#D97706]">1</span>
                    <span className="text-[#E8E4D9]">) + </span>
                    <span className="text-[#F59E0B]">fibonacci</span>
                    <span className="text-[#E8E4D9]">(n-</span>
                    <span className="text-[#D97706]">2</span>
                    <span className="text-[#E8E4D9]">)</span>
                  </div>
                  <div></div>
                  <div>
                    <span className="text-[#F59E0B]">output</span>
                    <span className="text-[#E8E4D9]">(</span>
                    <span className="text-[#F59E0B]">fibonacci</span>
                    <span className="text-[#E8E4D9]">(</span>
                    <span className="text-[#D97706]">10</span>
                    <span className="text-[#E8E4D9]">))</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
