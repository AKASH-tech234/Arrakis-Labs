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
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ type: "spring", stiffness: 420, damping: 30, delay: index * 0.15 }}

      /* ⚡ Faster hover response */
      whileHover={{
        y: -6,
        boxShadow: "0 0 60px rgba(245, 158, 11, 0.12)",
      }}
      whileTap={{ y: -4 }}
      className="relative group"
    >
      {/* Connector line */}
      {index < steps.length - 1 && (
        <div className="hidden lg:block absolute top-6 left-[calc(100%+8px)] w-[calc(100%-16px)] h-px 
                        bg-gradient-to-r from-[#92400E]/40 to-transparent 
                        group-hover:from-[#D97706]/70 
                        transition-colors duration-150" />
      )}

      <div className="relative">
        {/* Step number */}
        <div
          className="w-12 h-12 bg-gradient-to-br from-[#92400E] to-[#D97706] 
                     flex items-center justify-center mb-6 
                     transition-all duration-150 group-hover:brightness-110"
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
          className="text-lg font-medium text-[#E8E4D9] mb-3 tracking-wide uppercase 
                     transition-colors duration-150 group-hover:text-[#F59E0B]"
          style={{
            fontFamily: "'Rajdhani', system-ui, sans-serif",
            letterSpacing: "0.1em",
          }}
        >
          {step.title}
        </h3>

        <p
          className="text-[#78716C] leading-relaxed text-sm 
                     transition-colors duration-150 group-hover:text-[#9A8F82]"
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
          animate={headerInView ? { opacity: 1, y: 0 } : {}}
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
      </div>
    </section>
  );
}
