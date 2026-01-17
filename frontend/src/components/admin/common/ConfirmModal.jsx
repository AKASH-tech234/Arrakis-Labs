// src/components/admin/common/ConfirmModal.jsx
// Confirmation modal for destructive actions - Arrakis Labs Dune theme
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "warning", // 'warning' | 'danger' | 'info'
  requireTyping = false, // For dangerous actions, require typing a phrase
  typingPhrase = "",
  loading = false,
}) {
  const [typedValue, setTypedValue] = useState("");
  const canConfirm = !requireTyping || typedValue === typingPhrase;

  // Reset typed value when modal opens/closes
  useEffect(() => {
    if (!isOpen) setTypedValue("");
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const variantStyles = {
    warning: {
      icon: "⚠",
      iconColor: "text-[#F59E0B]",
      buttonBg: "bg-gradient-to-r from-[#92400E] to-[#D97706]",
      buttonHover: "hover:from-[#D97706] hover:to-[#F59E0B]",
    },
    danger: {
      icon: "⊘",
      iconColor: "text-red-500",
      buttonBg: "bg-gradient-to-r from-red-700 to-red-600",
      buttonHover: "hover:from-red-600 hover:to-red-500",
    },
    info: {
      icon: "ⓘ",
      iconColor: "text-blue-400",
      buttonBg: "bg-gradient-to-r from-[#92400E] to-[#D97706]",
      buttonHover: "hover:from-[#D97706] hover:to-[#F59E0B]",
    },
  };

  const style = variantStyles[variant];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
          >
            <div
              className="w-full max-w-md border border-[#1A1814]"
              style={{ backgroundColor: "#0D0D0B" }}
            >
              {/* Header */}
              <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1A1814]">
                <span className={`text-xl ${style.iconColor}`}>
                  {style.icon}
                </span>
                <h3
                  className="text-[#E8E4D9] text-sm uppercase tracking-[0.15em]"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  {title}
                </h3>
              </div>

              {/* Content */}
              <div className="px-6 py-5">
                <p
                  className="text-[#78716C] text-sm leading-relaxed"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  {message}
                </p>

                {/* Typing confirmation */}
                {requireTyping && (
                  <div className="mt-4">
                    <p
                      className="text-[#78716C] text-xs uppercase tracking-wider mb-2"
                      style={{
                        fontFamily: "'Rajdhani', system-ui, sans-serif",
                      }}
                    >
                      Type{" "}
                      <span className="text-[#E8E4D9]">{typingPhrase}</span> to
                      confirm:
                    </p>
                    <input
                      type="text"
                      value={typedValue}
                      onChange={(e) => setTypedValue(e.target.value)}
                      className="w-full bg-[#0A0A08] border border-[#1A1814] text-[#E8E4D9] px-4 py-2 text-sm
                                 focus:outline-none focus:border-[#92400E]/50 transition-all duration-200
                                 placeholder:text-[#3D3D3D]"
                      style={{
                        fontFamily: "'Rajdhani', system-ui, sans-serif",
                      }}
                      placeholder={typingPhrase}
                      autoFocus
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#1A1814]">
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2 border border-[#1A1814] text-[#78716C] hover:text-[#E8E4D9] 
                             hover:border-[#78716C] transition-colors duration-200 text-xs uppercase tracking-wider
                             disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  {cancelText}
                </button>
                <button
                  onClick={onConfirm}
                  disabled={!canConfirm || loading}
                  className={`px-4 py-2 ${style.buttonBg} text-[#0A0A08] ${style.buttonHover}
                              transition-all duration-300 text-xs uppercase tracking-[0.15em]
                              disabled:opacity-50 disabled:cursor-not-allowed`}
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 border-2 border-[#0A0A08]/30 border-t-[#0A0A08] rounded-full animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    confirmText
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
