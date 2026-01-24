import React from "react";
import { Flame } from "lucide-react";

export default function POTDEmptyState({ title = "No POTD", message, description }) {
  const text = description || message || "No Problem of the Day is available right now.";

  return (
    <div className="rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-6">
      <div className="flex items-start gap-4">
        <div className="mt-0.5 w-10 h-10 rounded-lg border border-[#1A1814] bg-[#0A0A08] flex items-center justify-center">
          <Flame className="w-5 h-5 text-[#D97706]" />
        </div>
        <div className="min-w-0">
          <h3
            className="text-[#E8E4D9] font-semibold tracking-wider uppercase"
            style={{ fontFamily: "'Rajdhani', 'Orbitron', system-ui, sans-serif" }}
          >
            {title}
          </h3>
          <p
            className="text-[#A29A8C] text-sm tracking-wide mt-1"
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}
