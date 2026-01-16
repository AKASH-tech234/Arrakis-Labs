import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function ScrollEffect() {
  const [scrollY, setScrollY] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [particles, setParticles] = useState([]);

  /* ─────────────────────
     Particle Generation
  ───────────────────── */
  useEffect(() => {
    const newParticles = Array.from({ length: 28 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1.5,
      drift: Math.random() * 20 + 10,
      duration: Math.random() * 10 + 8,
    }));
    setParticles(newParticles);
  }, []);

  /* ─────────────────────
     Scroll Listener
  ───────────────────── */
  useEffect(() => {
    const handleScroll = () => {
      const max =
        document.documentElement.scrollHeight - window.innerHeight;

      setScrollY(window.scrollY);
      setScrollProgress((window.scrollY / max) * 100);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      {/* ───────── TOP PROGRESS BAR (SUBTLE) ───────── */}
      <div
        className="fixed top-0 left-0 h-[2px] z-50 bg-gradient-to-r from-[#C17A2F] via-[#E3A94B] to-[#8A4F1D]"
        style={{
          width: `${scrollProgress}%`,
          boxShadow: `0 0 ${scrollProgress / 8}px rgba(227,169,75,0.4)`,
        }}
      />

      {/* ───────── BACKGROUND AMBIENT GLOW ───────── */}
      <div
        className="fixed inset-0 pointer-events-none z-10"
        style={{
          background: `radial-gradient(
            circle at center bottom,
            rgba(227,169,75,${scrollProgress / 160}),
            transparent 75%
          )`,
        }}
      />

      {/* ───────── PARTICLES (IDLE + SCROLL) ───────── */}
      <div className="fixed inset-0 pointer-events-none z-20">
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-[#E3A94B]/25"
            style={{
              width: p.size,
              height: p.size,
              left: `${p.x}%`,
              top: `${p.y}%`,
            }}
            animate={{
              y: [-p.drift, p.drift],
              x: [-p.drift / 2, p.drift / 2],
              opacity: [0.2, 0.6, 0.2],
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* ───────── SIDE LIGHT (VERY SOFT) ───────── */}
      <div
        className="fixed left-0 top-0 w-[1px] h-full pointer-events-none z-30"
        style={{
          background:
            "linear-gradient(to bottom, rgba(227,169,75,0.25), transparent)",
          transform: `translateY(${scrollY * 0.03}px)`,
        }}
      />
      <div
        className="fixed right-0 top-0 w-[1px] h-full pointer-events-none z-30"
        style={{
          background:
            "linear-gradient(to bottom, rgba(227,169,75,0.25), transparent)",
          transform: `translateY(-${scrollY * 0.03}px)`,
        }}
      />

      {/* ───────── SCROLL INDICATOR ───────── */}
      {scrollY < 1000 && (
        <motion.div
          className="fixed bottom-10 right-10 z-40 flex flex-col items-center gap-2 opacity-70"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2.2, repeat: Infinity }}
        >
          <span className="text-[#E3A94B] text-[10px] tracking-widest uppercase">
            Scroll
          </span>
          <div className="w-[1px] h-10 bg-gradient-to-b from-[#E3A94B] to-transparent rounded-full" />
        </motion.div>
      )}
    </>
  );
}
