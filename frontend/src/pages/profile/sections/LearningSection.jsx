import { memo } from "react";
import { motion } from "framer-motion";
import { LearningRoadmap } from "../../../components/mim";
import MistakeAnalysisCard from "../../../components/profile/MistakeAnalysisCard";
import LearningVelocityIndicator from "../../../components/profile/LearningVelocityIndicator";
import FocusAreasWidget from "../../../components/profile/FocusAreasWidget";

const sectionVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay },
  }),
};

const SectionHeader = memo(function SectionHeader({
  title,
  gradient = "from-[#D97706]",
  animated = false,
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {animated ? (
        <motion.div
          className={`w-1 h-5 bg-gradient-to-b ${gradient} to-transparent rounded-full`}
          animate={{ scaleY: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
        />
      ) : (
        <div
          className={`w-1 h-5 bg-gradient-to-b ${gradient} to-transparent rounded-full`}
        ></div>
      )}
      <h2
        className="text-[#E8E4D9] text-xs font-medium uppercase tracking-widest"
        style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
      >
        {title}
      </h2>
    </div>
  );
});

const RoadmapSection = memo(function RoadmapSection({ userId }) {
  if (!userId) return null;

  return (
    <motion.section
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      custom={0.05}
    >
      <SectionHeader title="Learning Roadmap" />
      <LearningRoadmap userId={userId} />
    </motion.section>
  );
});

const VelocitySection = memo(function VelocitySection({ userId }) {
  if (!userId) return null;

  return (
    <motion.div
      className="mb-4"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1 }}
    >
      <LearningVelocityIndicator userId={userId} />
    </motion.div>
  );
});

const FocusMistakesGrid = memo(function FocusMistakesGrid({ userId }) {
  if (!userId) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.15, type: "spring" }}
      >
        <FocusAreasWidget userId={userId} />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2, type: "spring" }}
      >
        <MistakeAnalysisCard userId={userId} />
      </motion.div>
    </div>
  );
});

const LearningFocusSection = memo(function LearningFocusSection({ userId }) {
  if (!userId) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1, type: "spring", stiffness: 100 }}
    >
      <SectionHeader
        title="Learning Focus"
        gradient="from-[#3B82F6]"
        animated
      />

      {}
      <VelocitySection userId={userId} />

      {}
      <FocusMistakesGrid userId={userId} />
    </motion.section>
  );
});

function LearningSection({ userId }) {
  if (!userId) {
    return (
      <div className="text-[#78716C] text-sm text-center py-8">
        Sign in to view learning progress
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {}
      <RoadmapSection userId={userId} />

      {}
      <LearningFocusSection userId={userId} />
    </div>
  );
}

export default memo(LearningSection);
