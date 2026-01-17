// src/components/landing/Footer.jsx
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import ArrakisLogo from "../ui/ArrakisLogo";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <motion.footer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="relative border-t-2 border-[#D97706]/40 py-16"
      style={{ backgroundColor: "#0A0A08" }}
    >
      {/* Background accent */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#D97706]/5 via-transparent to-transparent pointer-events-none"></div>

      {/* Top glow line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#D97706]/60 to-transparent"></div>

      <div className="max-w-6xl mx-auto px-6 lg:px-12 relative z-10">
        <div className="flex flex-col items-center gap-12">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <ArrakisLogo size="lg" showWordmark={true} animated={true} />
          </motion.div>

          {/* Links */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex items-center gap-10"
          >
            <a
              href="#features"
              className="text-[#f4efed] hover:text-[#F59E0B] transition-colors duration-300 text-xs tracking-[0.15em] uppercase font-medium group"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              <span className="relative">
                Features
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-[#D97706] to-[#F59E0B] group-hover:w-full transition-all duration-300"></span>
              </span>
            </a>
            <div className="w-px h-6 bg-gradient-to-b from-transparent via-[#D97706]/40 to-transparent"></div>
            <a
              href="#how-it-works"
              className="text-[#f4efed] hover:text-[#F59E0B] transition-colors duration-300 text-xs tracking-[0.15em] uppercase font-medium group"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              <span className="relative">
                Process
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-[#D97706] to-[#F59E0B] group-hover:w-full transition-all duration-300"></span>
              </span>
            </a>
            <div className="w-px h-6 bg-gradient-to-b from-transparent via-[#D97706]/40 to-transparent"></div>
            <Link
              to="/login"
              className="text-[#f4efed] hover:text-[#F59E0B] transition-colors duration-300 text-xs tracking-[0.15em] uppercase font-medium group"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              <span className="relative">
                Enter
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-[#D97706] to-[#F59E0B] group-hover:w-full transition-all duration-300"></span>
              </span>
            </Link>
          </motion.div>

          {/* Divider */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="w-32 h-px bg-gradient-to-r from-transparent via-[#D97706] to-transparent"
          />
 
          {/* Copyright */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-[#000000] text-xs tracking-[0.1em] uppercase font-medium text-center max-w-2xl"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif text-bold " }}
          >
            © {currentYear} Arrakis Labs · Silence of the desert forges the deadliest intelligence.
          </motion.p>
        </div>
      </div>
    </motion.footer>
  );
}
