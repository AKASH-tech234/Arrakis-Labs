import { memo } from "react";
import { motion } from "framer-motion";
import {
  CognitiveProfile,
  ProblemRecommendations,
  SkillRadarChart,
} from "../../../components/mim";
import InsightsPatterns from "../../../components/profile/InsightsPatterns";
import {
  TopicMasteryGrid,
  NextProblemCard,
  WeakAreaFocus,
} from "../../../components/profile/AdvancedProfileWidgets";
import AIInsightsSummary from "../../../components/profile/AIInsightsSummary";

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
          transition={{ duration: 2, repeat: Infinity }}
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

const CognitiveProfileSection = memo(function CognitiveProfileSection({
  userId,
}) {
  if (!userId) return null;

  return (
    <motion.section
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      custom={0.05}
    >
      <SectionHeader title="AI Cognitive Profile" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CognitiveProfile userId={userId} compact />
        <div className="rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-4 hover:border-[#D97706]/40 transition-colors">
          <SkillRadarChart userId={userId} />
        </div>
      </div>
    </motion.section>
  );
});

const RecommendationsSection = memo(function RecommendationsSection({
  userId,
}) {
  if (!userId) return null;

  return (
    <motion.section
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      custom={0.1}
    >
      <SectionHeader title="Recommended Problems" />
      <ProblemRecommendations userId={userId} limit={5} />
    </motion.section>
  );
});

const PatternsSection = memo(function PatternsSection({ userId }) {
  if (!userId) return null;

  return (
    <motion.section
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      custom={0.15}
    >
      <SectionHeader title="Insights & Patterns" gradient="from-[#F59E0B]" />
      <InsightsPatterns userId={userId} />
    </motion.section>
  );
});

const NextChallengeSection = memo(function NextChallengeSection({ userId }) {
  if (!userId) return null;

  return (
    <motion.section
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      custom={0.2}
    >
      <SectionHeader title="Recommended For You" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <NextProblemCard userId={userId} />
        <WeakAreaFocus userId={userId} />
      </div>
    </motion.section>
  );
});

const TopicMasterySection = memo(function TopicMasterySection({ userId }) {
  if (!userId) return null;

  return (
    <motion.section
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      custom={0.25}
    >
      <SectionHeader title="Topic Mastery" gradient="from-[#F59E0B]" />
      <TopicMasteryGrid userId={userId} />
    </motion.section>
  );
});

const AIInsightsDashboard = memo(function AIInsightsDashboard({ userId }) {
  if (!userId) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3, type: "spring", stiffness: 100 }}
    >
      <SectionHeader
        title="AI Insights Dashboard"
        gradient="from-[#8B5CF6]"
        animated
      />
      <AIInsightsSummary userId={userId} />
    </motion.section>
  );
});

function InsightsSection({ userId }) {
  if (!userId) {
    return (
      <div className="text-[#78716C] text-sm text-center py-8">
        Sign in to view AI insights
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {}
      <CognitiveProfileSection userId={userId} />

      {}
      <RecommendationsSection userId={userId} />

      {}
      <PatternsSection userId={userId} />

      {}
      <NextChallengeSection userId={userId} />

      {}
      <TopicMasterySection userId={userId} />

      {}
      <AIInsightsDashboard userId={userId} />
    </div>
  );
}

export default memo(InsightsSection);
