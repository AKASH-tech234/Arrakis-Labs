import { cn } from "./cn";

const VARIANTS = {
  live: "bg-[#1A2A16] text-[#86EFAC] border-[#14532D]",
  upcoming: "bg-[#0F1A2A] text-[#93C5FD] border-[#1E3A8A]",
  ended: "bg-[#1A1814] text-[#A29A8C] border-[#3D3D3D]",
  success: "bg-[#1A2A16] text-[#86EFAC] border-[#14532D]",
  warning: "bg-[#2A1F0F] text-[#FDE68A] border-[#92400E]",
  danger: "bg-[#2A0F0F] text-[#FCA5A5] border-[#7F1D1D]",
  neutral: "bg-[#1A1814] text-[#E8E4D9] border-[#3D3D3D]",
};

export default function Badge({ variant = "neutral", className, children }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 text-[10px] uppercase tracking-[0.15em] border rounded-none",
        VARIANTS[variant] || VARIANTS.neutral,
        className,
      )}
      style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
    >
      {children}
    </span>
  );
}
