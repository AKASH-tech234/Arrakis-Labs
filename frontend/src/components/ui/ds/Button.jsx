import { cn } from "./cn";

const VARIANTS = {
  primary:
    "bg-gradient-to-r from-[#92400E] to-[#D97706] text-[#0A0A08] hover:from-[#D97706] hover:to-[#F59E0B] shadow-sm hover:shadow-lg hover:shadow-[#F59E0B]/15",
  secondary:
    "bg-[#121210] text-[#E8E4D9] border border-[#1A1814] hover:border-[#92400E]/60 hover:bg-[#1A1814]",
  ghost:
    "bg-transparent text-[#E8E4D9] hover:bg-[#1A1814] border border-transparent hover:border-[#1A1814]",
  danger:
    "bg-[#2A0F0F] text-[#FCA5A5] border border-[#3A1515] hover:bg-[#3A1515]",
};

const SIZES = {
  sm: "px-3 py-2 text-xs",
  md: "px-5 py-3 text-xs",
  lg: "px-6 py-3.5 text-sm",
};

export default function Button({
  as: Comp = "button",
  variant = "secondary",
  size = "md",
  className,
  disabled,
  children,
  ...props
}) {
  return (
    <Comp
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-none transition-all duration-300",
        "font-semibold uppercase tracking-[0.12em]",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#F59E0B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A08]",
        "disabled:opacity-50 disabled:pointer-events-none",
        VARIANTS[variant] || VARIANTS.secondary,
        SIZES[size] || SIZES.md,
        className,
      )}
      style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
      disabled={disabled}
      {...props}
    >
      {children}
    </Comp>
  );
}
