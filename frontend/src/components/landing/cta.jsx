// src/components/landing/CTA.jsx - Dune-Inspired
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Link } from "react-router-dom";
import ArrakisLogo from "../ui/ArrakisLogo";

export default function CTA() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      ref={ref}
      className="py-24 md:py-32"
      style={{ backgroundColor: "#0A0A08" }}
    >
      <div className="max-w-4xl mx-auto px-6 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative border border-[#1A1814] p-10 md:p-16 text-center overflow-hidden"
          style={{ backgroundColor: "#0D0D0B" }}
        >
          {/* Background glow - subtle amber */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[250px] blur-[100px] -z-10"
            style={{
              background:
                "radial-gradient(circle, rgba(217, 119, 6, 0.08) 0%, transparent 70%)",
            }}
          />

          {/* Logo at top */}
          <div className="mb-10">
            <ArrakisLogo size="lg" showWordmark={false} animated={isInView} />
          </div>

          <span
            className="inline-block px-5 py-2 border border-[#92400E]/30 text-[#D97706] text-xs tracking-[0.2em] uppercase mb-8"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            Begin Your Journey
          </span>

          <h2
            className="text-3xl md:text-4xl lg:text-5xl font-medium text-[#E8E4D9] mb-6"
            style={{
              fontFamily: "'Orbitron', 'Rajdhani', system-ui, sans-serif",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              textShadow: "0 0 40px rgba(245, 158, 11, 0.1)",
            }}
          >
            The Trial Awaits
          </h2>

          <p
            className="text-[#78716C] max-w-xl mx-auto mb-10 text-base leading-relaxed"
            style={{
              fontFamily: "'Rajdhani', system-ui, sans-serif",
              letterSpacing: "0.03em",
            }}
          >
           Enter the silence.
Every action leaves a trace. Every pause reveals intent.
The AI observes your patterns, remembers your evolution,
and sharpens your path toward mastery—one deliberate step at a time.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/signup"
              className="px-10 py-4 bg-gradient-to-r from-[#92400E] to-[#D97706] text-[#0A0A08] font-semibold text-xs tracking-[0.15em] uppercase
                       hover:from-[#D97706] hover:to-[#F59E0B] transition-all duration-300 hover:shadow-lg hover:shadow-[#F59E0B]/20"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Begin Trial
            </Link>
            <Link
              to="/login"
              className="px-10 py-4 border border-[#92400E]/40 text-[#E8E4D9] font-medium text-xs tracking-[0.15em] uppercase
                       hover:border-[#D97706]/60 hover:bg-[#92400E]/10 transition-all duration-300"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Enter System
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
