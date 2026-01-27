/**
 * Reusable StatCard component for displaying statistics
 * Used across Profile, Coding Profile, and POTD pages
 */
export default function StatCard({ label, value, icon: Icon, accent = false }) {
  return (
    <div className={`rounded-xl border ${accent ? 'border-[#D97706]/30 bg-[#D97706]/5' : 'border-[#1A1814] bg-[#0F0F0D]'} p-4 hover:border-[#D97706]/40 transition-colors`}>
      <div className="flex items-center justify-between">
        <div>
          <p 
            className="text-[10px] uppercase tracking-widest text-[#78716C] mb-1" 
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {label}
          </p>
          <p 
            className="text-xl font-bold text-[#E8E4D9]" 
            style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
          >
            {value ?? "—"}
          </p>
        </div>
        {Icon && (
          <div className={`p-2 rounded-lg ${accent ? 'bg-[#D97706]/10' : 'bg-[#1A1814]'}`}>
            <Icon className={`w-4 h-4 ${accent ? 'text-[#D97706]' : 'text-[#78716C]'}`} />
          </div>
        )}
      </div>
    </div>
  );
}
