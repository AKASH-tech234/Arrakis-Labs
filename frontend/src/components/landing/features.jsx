// src/components/landing/Features.jsx
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const features = [
  {
    icon: "🧠",
    title: "Memory-Driven AI",
    description:
      "Your AI companion remembers every submission and breakthrough. It builds a living model of your growth and adapts its guidance accordingly.",
  },
  {
    icon: "🎯",
    title: "Adaptive Learning Paths",
    description:
      "No fixed curriculum. The system observes your patterns, identifies gaps, and constructs personalized challenges.",
  },
  {
    icon: "🔒",
    title: "Secure Execution",
    description:
      "Sandboxed environments execute your code in isolation. Focus on solving problems without worrying about infrastructure.",
  },
  {
    icon: "📊",
    title: "Skill Analytics",
    description:
      "Track your evolution over weeks and months. Understand how your thinking has matured and where mastery awaits.",
  },
];

function FeatureCard({ feature, index }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: "easeOut" }}
      className="group"
    >
      <div className="p-6 md:p-8 bg-neutral-900/50 border border-neutral-800 rounded-xl hover:border-neutral-700 hover:bg-neutral-900/80 transition-all duration-300">
        <div className="text-3xl mb-4">{feature.icon}</div>
        <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
        <p className="text-neutral-400 leading-relaxed text-sm">
          {feature.description}
        </p>
      </div>
    </motion.div>
  );
}

export default function Features() {
  const headerRef = useRef(null);
  const headerInView = useInView(headerRef, { once: true, margin: "-50px" });

  return (
    <section id="features" className="bg-black py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-6 lg:px-12">
        {/* Section Header */}
        <motion.div
          ref={headerRef}
          initial={{ opacity: 0, y: 20 }}
          animate={headerInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-sm font-medium mb-6">
            Features
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
            Everything You Need to
            <span className="block bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
              Level Up Your Skills
            </span>
          </h2>
          <p className="text-neutral-400 max-w-2xl mx-auto text-lg">
            A thinking partner, not a shortcut. Our system emphasizes reasoning,
            memory, and the deliberate cultivation of skill.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
