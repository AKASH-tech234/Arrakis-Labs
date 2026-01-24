import React from "react";

/**
 * Section wrapper matching the authenticated app (Arrakis) theme.
 */
export default function POTDSection({ title, subtitle, right, children }) {
  return (
    <section className="rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-6 shadow-[0_0_0_1px_rgba(217,119,6,0.06)]">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          {title ? (
            <h2
              className="text-[#E8E4D9] text-lg font-semibold tracking-wider uppercase"
              style={{ fontFamily: "'Rajdhani', 'Orbitron', system-ui, sans-serif" }}
            >
              {title}
            </h2>
          ) : null}
          {subtitle ? (
            <p
              className="text-[#A29A8C] text-sm tracking-wide mt-1"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      {children}
    </section>
  );
}
