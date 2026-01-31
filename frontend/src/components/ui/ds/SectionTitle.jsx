import { cn } from "./cn";

export default function SectionTitle({ title, subtitle, className }) {
  return (
    <div className={cn("flex items-start justify-between gap-6", className)}>
      <div>
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-gradient-to-b from-[#D97706] to-transparent" />
          <h2
            className="text-[#E8E4D9] text-lg tracking-[0.2em] uppercase"
            style={{ fontFamily: "'Rajdhani', 'Orbitron', system-ui, sans-serif" }}
          >
            {title}
          </h2>
        </div>
        {subtitle ? <p className="mt-2 text-sm text-[#78716C]">{subtitle}</p> : null}
      </div>
    </div>
  );
}
