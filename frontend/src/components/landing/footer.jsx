// src/components/landing/Footer.jsx
import { Link } from "react-router-dom";
import ArrakisLogo from "../ui/ArrakisLogo";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className="border-t border-[#1A1814] py-16"
      style={{ backgroundColor: "#0A0A08" }}
    >
      <div className="max-w-6xl mx-auto px-6 lg:px-12">
        <div className="flex flex-col items-center gap-10">
          {/* Logo */}
          <ArrakisLogo size="lg" showWordmark={true} animated={false} />

          {/* Links */}
          <div className="flex items-center gap-10">
            <a
              href="#features"
              className="text-[#78716C] hover:text-[#E8E4D9] transition-colors text-xs tracking-[0.15em] uppercase"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-[#78716C] hover:text-[#E8E4D9] transition-colors text-xs tracking-[0.15em] uppercase"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Process
            </a>
            <Link
              to="/login"
              className="text-[#78716C] hover:text-[#E8E4D9] transition-colors text-xs tracking-[0.15em] uppercase"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Enter
            </Link>
          </div>

          {/* Divider */}
          <div className="w-24 h-px bg-gradient-to-r from-transparent via-[#92400E]/50 to-transparent" />

          {/* Copyright */}
          <p
            className="text-[#78716C] text-xs tracking-[0.1em] uppercase"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            © {currentYear} Arrakis Labs · Intelligence born of desert silence
          </p>
        </div>
      </div>
    </footer>
  );
}
