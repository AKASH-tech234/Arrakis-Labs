import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import SolutionDiscussion from "./SolutionDiscussion";

export default function DiscussDrawer({
  open,
  onClose,
  problem,
  lastAcceptedSubmission,
}) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[80]"
            onClick={onClose}
          />

          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed top-0 right-0 h-full w-full md:w-[560px] z-[90] border-l border-[#1A1814] bg-[#0A0A08]"
            role="dialog"
            aria-modal="true"
            aria-label="Discuss"
          >
            <div className="h-14 flex items-center justify-between px-6 border-b border-[#1A1814] bg-[#0F0F0D]">
              <div>
                <div
                  className="text-[#78716C] text-[10px] tracking-[0.25em] uppercase"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  Discuss
                </div>
                <div
                  className="text-[#E8E4D9] text-sm font-semibold tracking-wider truncate max-w-[360px]"
                  style={{ fontFamily: "'Rajdhani', 'Orbitron', system-ui, sans-serif" }}
                  title={problem?.title}
                >
                  {problem?.title || "Problem"}
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded border border-[#2A2A24] bg-[#0A0A08] hover:border-[#D97706]/50 transition-colors flex items-center justify-center"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-[#E8E4D9]" />
              </button>
            </div>

            <div className="h-[calc(100%-3.5rem)] overflow-hidden">
              <SolutionDiscussion
                problemId={problem?.id || problem?._id}
                lastAcceptedSubmission={lastAcceptedSubmission}
              />
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
