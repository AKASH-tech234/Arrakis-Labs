// src/components/admin/common/Drawer.jsx
// Slide-out drawer panel - Arrakis Labs Dune theme
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  width = "md", // 'sm' | 'md' | 'lg' | 'xl' | 'full'
  side = "right", // 'left' | 'right'
  showOverlay = true,
  footer,
}) {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const widthClasses = {
    sm: "w-80",
    md: "w-96",
    lg: "w-[32rem]",
    xl: "w-[40rem]",
    full: "w-full max-w-3xl",
  };

  const slideVariants = {
    left: {
      initial: { x: "-100%" },
      animate: { x: 0 },
      exit: { x: "-100%" },
    },
    right: {
      initial: { x: "100%" },
      animate: { x: 0 },
      exit: { x: "100%" },
    },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          {showOverlay && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            />
          )}

          {/* Drawer Panel */}
          <motion.div
            initial={slideVariants[side].initial}
            animate={slideVariants[side].animate}
            exit={slideVariants[side].exit}
            transition={{ type: "tween", duration: 0.25 }}
            className={`fixed top-0 bottom-0 ${side === "left" ? "left-0" : "right-0"} 
                        ${widthClasses[width]} border-${side === "left" ? "r" : "l"} 
                        border-[#1A1814] z-50 flex flex-col`}
            style={{ backgroundColor: "#0A0A08" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1A1814]">
              <div>
                <h2
                  className="text-[#E8E4D9] text-sm uppercase tracking-[0.15em]"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  {title}
                </h2>
                {subtitle && (
                  <p
                    className="text-[#78716C] text-xs uppercase tracking-wider mt-0.5"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    {subtitle}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center text-[#78716C] 
                           hover:text-[#E8E4D9] hover:bg-[#1A1814] transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">{children}</div>

            {/* Footer */}
            {footer && (
              <div className="px-6 py-4 border-t border-[#1A1814]">
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
