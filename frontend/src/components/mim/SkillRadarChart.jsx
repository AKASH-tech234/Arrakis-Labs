// src/components/mim/SkillRadarChart.jsx
// Interactive radar chart visualization of user's topic competencies
import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { getMIMProfile } from "../../services/aiApi";

// Calculate point position on radar
const calculatePoint = (angle, value, maxValue, radius) => {
  const normalizedValue = (value / maxValue) * radius;
  const radian = ((angle - 90) * Math.PI) / 180;
  return {
    x: Math.cos(radian) * normalizedValue,
    y: Math.sin(radian) * normalizedValue,
  };
};

// Radar grid component
const RadarGrid = ({ levels = 4, labels, radius, center }) => {
  const angleStep = 360 / labels.length;

  return (
    <g>
      {/* Concentric polygons */}
      {[...Array(levels)].map((_, levelIndex) => {
        const levelRadius = ((levelIndex + 1) / levels) * radius;
        const points = labels.map((_, i) => {
          const point = calculatePoint(i * angleStep, 1, 1, levelRadius);
          return `${center + point.x},${center + point.y}`;
        });
        return (
          <polygon
            key={`grid-${levelIndex}`}
            points={points.join(" ")}
            fill="none"
            stroke="#78716C"
            strokeWidth="0.5"
            opacity={0.2 + levelIndex * 0.1}
          />
        );
      })}

      {/* Axis lines */}
      {labels.map((label, i) => {
        const point = calculatePoint(i * angleStep, 1, 1, radius);
        return (
          <line
            key={`axis-${i}`}
            x1={center}
            y1={center}
            x2={center + point.x}
            y2={center + point.y}
            stroke="#78716C"
            strokeWidth="0.5"
            opacity="0.3"
          />
        );
      })}

      {/* Labels */}
      {labels.map((label, i) => {
        const point = calculatePoint(i * angleStep, 1, 1, radius + 20);
        return (
          <text
            key={`label-${i}`}
            x={center + point.x}
            y={center + point.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#A8A29E"
            fontSize="10"
            fontFamily="'Rajdhani', system-ui, sans-serif"
          >
            {label.length > 10 ? label.substring(0, 10) + "..." : label}
          </text>
        );
      })}
    </g>
  );
};

// Animated data polygon
const DataPolygon = ({
  skills,
  maxValue,
  radius,
  center,
  color,
  delay = 0,
}) => {
  const points = useMemo(() => {
    const angleStep = 360 / skills.length;
    return skills.map((skill, i) => {
      const point = calculatePoint(
        i * angleStep,
        skill.value,
        maxValue,
        radius,
      );
      return `${center + point.x},${center + point.y}`;
    });
  }, [skills, maxValue, radius, center]);

  return (
    <motion.polygon
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      points={points.join(" ")}
      fill={`${color}20`}
      stroke={color}
      strokeWidth="2"
      style={{ transformOrigin: `${center}px ${center}px` }}
    />
  );
};

// Data point markers
const DataPoints = ({ skills, maxValue, radius, center, color, onHover }) => {
  const angleStep = 360 / skills.length;

  return (
    <g>
      {skills.map((skill, i) => {
        const point = calculatePoint(
          i * angleStep,
          skill.value,
          maxValue,
          radius,
        );
        return (
          <motion.circle
            key={skill.name}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.4 + i * 0.05 }}
            cx={center + point.x}
            cy={center + point.y}
            r="4"
            fill={color}
            stroke="#0A0A08"
            strokeWidth="2"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => onHover(skill)}
            onMouseLeave={() => onHover(null)}
          />
        );
      })}
    </g>
  );
};

// Skill tooltip
const SkillTooltip = ({ skill, position }) => {
  if (!skill) return null;

  const levelLabel =
    skill.value >= 80
      ? "Expert"
      : skill.value >= 60
        ? "Advanced"
        : skill.value >= 40
          ? "Intermediate"
          : skill.value >= 20
            ? "Beginner"
            : "Novice";

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="absolute z-10 bg-[#1A1814] border border-[#D97706]/40 rounded-lg px-3 py-2 shadow-lg"
      style={{
        left: position.x,
        top: position.y,
        transform: "translate(-50%, -100%)",
      }}
    >
      <p
        className="text-[#E8E4D9] text-sm font-medium"
        style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
      >
        {skill.name}
      </p>
      <p className="text-[#D97706] text-xs">
        {skill.value}% ({levelLabel})
      </p>
      {skill.problemsSolved !== undefined && (
        <p className="text-[#78716C] text-xs">
          {skill.problemsSolved} problems solved
        </p>
      )}
    </motion.div>
  );
};

// Legend component
const Legend = ({ items }) => (
  <div className="flex flex-wrap justify-center gap-4 mt-4">
    {items.map((item) => (
      <div key={item.label} className="flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: item.color }}
        />
        <span className="text-xs text-[#A8A29E]">{item.label}</span>
      </div>
    ))}
  </div>
);

export default function SkillRadarChart({
  userId,
  size = 300,
  showLegend = true,
}) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredSkill, setHoveredSkill] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const fetchProfile = useCallback(async () => {
    if (!userId) return;

    try {
      const data = await getMIMProfile({ userId });
      setProfile(data);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to load skills data");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    fetchProfile();
  }, [fetchProfile]);

  // Process skill data from profile
  const skillData = useMemo(() => {
    if (!profile) return [];

    // Extract skill levels from profile
    const skillLevels = profile.skill_levels || profile.readiness_scores || {};
    const strengths = profile.strengths || [];
    const weaknesses = profile.weaknesses || [];

    // Build skills array
    const skills = [];

    // Add topic competencies
    Object.entries(skillLevels).forEach(([topic, level]) => {
      const value = typeof level === "number" ? level * 100 : 50;
      skills.push({
        name: topic,
        value: Math.min(100, Math.max(0, value)),
        isStrength: strengths.includes(topic),
        isWeakness: weaknesses.includes(topic),
      });
    });

    // If no skill levels, create from strengths/weaknesses
    if (skills.length === 0) {
      strengths.forEach((s) =>
        skills.push({ name: s, value: 75, isStrength: true }),
      );
      weaknesses.forEach((w) =>
        skills.push({ name: w, value: 35, isWeakness: true }),
      );
    }

    // Ensure minimum skills for visualization
    const defaultTopics = [
      "Arrays",
      "Strings",
      "Trees",
      "Graphs",
      "DP",
      "Math",
    ];
    if (skills.length < 4) {
      defaultTopics.forEach((topic) => {
        if (!skills.find((s) => s.name === topic)) {
          skills.push({ name: topic, value: 30, isDefault: true });
        }
      });
    }

    // Limit to reasonable number
    return skills.slice(0, 8);
  }, [profile]);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  if (loading) {
    return (
      <div
        className="rounded-lg border border-[#D97706]/20 bg-[#0A0A08]/60 flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          className="w-6 h-6 border-2 border-[#D97706] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-lg border border-[#92400E]/30 bg-[#92400E]/5 flex items-center justify-center p-4"
        style={{ width: size, height: size }}
      >
        <p className="text-[#D97706] text-sm text-center">{error}</p>
      </div>
    );
  }

  if (skillData.length < 3) {
    return (
      <div
        className="rounded-lg border border-[#D97706]/20 bg-[#0A0A08]/60 flex items-center justify-center p-4"
        style={{ width: size, height: size }}
      >
        <p className="text-[#78716C] text-sm text-center">
          Solve problems in more categories to unlock your skill radar!
        </p>
      </div>
    );
  }

  const radius = (size - 80) / 2;
  const center = size / 2;
  const maxValue = 100;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="rounded-lg border border-[#D97706]/20 bg-linear-to-br from-[#1A1814]/60 to-[#0A0A08]/60 backdrop-blur-sm p-4"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[#D97706]">📊</span>
        <h3
          className="text-[#E8E4D9] text-sm uppercase tracking-wider"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          Skill Radar
        </h3>
      </div>

      {/* Radar Chart */}
      <div
        className="relative"
        onMouseMove={handleMouseMove}
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Grid */}
          <RadarGrid
            levels={4}
            labels={skillData.map((s) => s.name)}
            radius={radius}
            center={center}
          />

          {/* Data polygon */}
          <DataPolygon
            skills={skillData}
            maxValue={maxValue}
            radius={radius}
            center={center}
            color="#D97706"
          />

          {/* Data points */}
          <DataPoints
            skills={skillData}
            maxValue={maxValue}
            radius={radius}
            center={center}
            color="#D97706"
            onHover={setHoveredSkill}
          />
        </svg>

        {/* Tooltip */}
        {hoveredSkill && (
          <SkillTooltip skill={hoveredSkill} position={mousePos} />
        )}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="mt-4 pt-4 border-t border-[#D97706]/10">
          <div className="flex flex-wrap justify-center gap-2">
            {skillData.map((skill) => (
              <span
                key={skill.name}
                className={`text-xs px-2 py-1 rounded ${
                  skill.isStrength
                    ? "bg-[#10B981]/20 text-[#10B981]"
                    : skill.isWeakness
                      ? "bg-[#EF4444]/20 text-[#EF4444]"
                      : "bg-[#1A1814] text-[#78716C]"
                }`}
              >
                {skill.name}: {skill.value}%
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
