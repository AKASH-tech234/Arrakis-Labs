// src/components/charts/ProfileHeader.jsx
// User profile header with minimal info

const mockUser = {
  name: "Paul Atreides",
  username: "muaddib",
  descriptor: "In disciplined practice",
  memberSince: "2024",
};

export default function ProfileHeader() {
  return (
    <div className="flex items-start gap-6">
      {/* Avatar */}
      <div className="w-20 h-20 border border-[#1A1814] flex items-center justify-center flex-shrink-0">
        <span
          className="text-[#78716C] text-2xl uppercase"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          {mockUser.name.charAt(0)}
        </span>
      </div>

      {/* User Info */}
      <div className="space-y-2">
        <h1
          className="text-[#E8E4D9] text-xl font-medium tracking-wide"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          {mockUser.name}
        </h1>
        <p
          className="text-[#78716C] text-xs uppercase tracking-wider"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          @{mockUser.username}
        </p>
        <p
          className="text-[#3D3D3D] text-xs italic tracking-wide"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          {mockUser.descriptor}
        </p>
        <p
          className="text-[#3D3D3D] text-[10px] uppercase tracking-wider pt-2"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          Member since {mockUser.memberSince}
        </p>
      </div>
    </div>
  );
}
