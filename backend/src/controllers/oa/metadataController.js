import { CompanyOAPattern } from "../../models/oa/index.js";
import Question from "../../models/question/Question.js";

const TOPIC_VARIATIONS = {
  "Array": ["Array", "Arrays", "array", "arrays"],
  "String": ["String", "Strings", "string", "strings"],
  "LinkedList": ["LinkedList", "Linked List", "linkedlist", "linked-list", "Linked-List"],
  "Stack": ["Stack", "Stacks", "stack"],
  "Queue": ["Queue", "Queues", "queue"],
  "Tree": ["Tree", "Trees", "tree", "Binary Tree", "BST"],
  "Graph": ["Graph", "Graphs", "graph"],
  "DynamicProgramming": ["DynamicProgramming", "Dynamic Programming", "DP", "dp", "dynamicprogramming"],
  "Greedy": ["Greedy", "greedy"],
  "Backtracking": ["Backtracking", "backtracking"],
  "BinarySearch": ["BinarySearch", "Binary Search", "binarysearch", "binary-search"],
  "Sorting": ["Sorting", "Sort", "sorting", "sort"],
  "Hashing": ["Hashing", "Hash", "hashing", "hash", "HashMap", "HashSet"],
  "Heap": ["Heap", "Heaps", "heap", "Priority Queue", "PriorityQueue"],
  "Trie": ["Trie", "trie", "Prefix Tree"],
  "BitManipulation": ["BitManipulation", "Bit Manipulation", "bitmanipulation", "Bit", "Bits"],
  "TwoPointers": ["TwoPointers", "Two Pointers", "twopointers", "two-pointers"],
  "SlidingWindow": ["SlidingWindow", "Sliding Window", "slidingwindow", "sliding-window"],
  "Recursion": ["Recursion", "recursion", "Recursive"],
  "Math": ["Math", "math", "Mathematics"],
};

const VARIATION_TO_CANONICAL = {};
for (const [canonical, variations] of Object.entries(TOPIC_VARIATIONS)) {
  for (const v of variations) {
    VARIATION_TO_CANONICAL[v.toLowerCase()] = canonical;
  }
}

const ALL_TOPIC_VARIATIONS = Object.values(TOPIC_VARIATIONS).flat();

const DEFAULT_COMPANIES = [
  "Google",
  "Amazon",
  "Meta",
  "Microsoft",
  "Apple",
  "Netflix",
  "Tesla",
  "Bloomberg",
  "LinkedIn",
  "Uber",
  "Airbnb",
  "Stripe",
  "Coinbase",
  "Snap",
  "Twitter",
];

const DIFFICULTY_DISTRIBUTIONS = {
  easy: { easy: 100, medium: 0, hard: 0 },
  medium: { easy: 0, medium: 100, hard: 0 },
  hard: { easy: 0, medium: 0, hard: 100 },
  mixed: { easy: 30, medium: 50, hard: 20 },
  adaptive: { easy: 25, medium: 50, hard: 25 },
};

const DURATION_OPTIONS = [
  { value: 30, label: "30 minutes" },
  { value: 45, label: "45 minutes" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
];

export const getOAMetadata = async (req, res) => {
  try {

    const topicAggregation = await Question.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          topics: { $addToSet: "$topic" },
          categoryTypes: { $addToSet: "$categoryType" },
          allTags: { $push: "$tags" },
        },
      },
    ]);

    let availableTopics = [];
    const foundTopicsSet = new Set();

    if (topicAggregation.length > 0) {
      const { topics, categoryTypes, allTags } = topicAggregation[0];
      const flatTags = (allTags || []).flat();
      const allTopicValues = [...(topics || []), ...(categoryTypes || []), ...flatTags];

      for (const t of allTopicValues) {
        if (!t) continue;
        const canonical = VARIATION_TO_CANONICAL[t.toLowerCase()];
        if (canonical) {
          foundTopicsSet.add(canonical);
        }
      }

      availableTopics = [...foundTopicsSet].sort();
    }

    if (availableTopics.length === 0) {
      availableTopics = Object.keys(TOPIC_VARIATIONS);
    }

    const companyAggregation = await Question.aggregate([
      { $match: { isActive: true, companies: { $exists: true, $ne: [] } } },
      { $unwind: "$companies" },
      {
        $group: {
          _id: "$companies",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const companyMap = new Map();
    for (const c of companyAggregation) {
      const normalized = c._id.charAt(0).toUpperCase() + c._id.slice(1);
      const existing = companyMap.get(normalized);
      if (existing) {
        existing.count += c.count;
        existing.variations.push(c._id);
      } else {
        companyMap.set(normalized, { name: normalized, count: c.count, variations: [c._id] });
      }
    }

    const availableCompanies = Array.from(companyMap.values())
      .sort((a, b) => b.count - a.count)
      .map(c => ({ name: c.name, count: c.count, variations: c.variations }));

    const difficultyCounts = await Question.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: "$difficulty",
          count: { $sum: 1 },
        },
      },
    ]);

    const questionsByDifficulty = {};
    difficultyCounts.forEach((d) => {
      questionsByDifficulty[d._id] = d.count;
    });

    const totalQuestions = Object.values(questionsByDifficulty).reduce((a, b) => a + b, 0);

    const companies = availableCompanies.length > 0
      ? availableCompanies.map((c) => ({
          name: c.name,
          count: c.count,
          variations: c.variations,
          logo: null,
          defaultTopics: [],
          difficultyDistribution: DIFFICULTY_DISTRIBUTIONS.mixed,
          available: true,
        }))
      : DEFAULT_COMPANIES.map((name) => ({
          name,
          count: 0,
          variations: [name],
          logo: null,
          defaultTopics: [],
          difficultyDistribution: DIFFICULTY_DISTRIBUTIONS.mixed,
          available: false,
        }));

    res.json({
      success: true,
      data: {

        topics: availableTopics,

        companies,

        questionStats: {
          total: totalQuestions,
          byDifficulty: questionsByDifficulty,
        },

        difficultyOptions: ["Easy", "Medium", "Hard", "mixed", "adaptive"],
        difficultyDistributions: DIFFICULTY_DISTRIBUTIONS,
        durationOptions: DURATION_OPTIONS,
        questionCounts: {
          coding: { min: 1, max: Math.min(5, totalQuestions), default: 2 },
        },
        proctoring: {
          defaultTabSwitchWarnings: 3,
        },
        defaults: {
          duration: 60,
          difficulty: "mixed",
          questionCounts: { coding: 2 },
          proctoring: {
            enabled: true,
            detectTabSwitch: true,
            warningsAllowed: 3,
          },
        },
      },
    });
  } catch (error) {
    console.error("Error fetching OA metadata:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch OA metadata",
      message: error.message,
    });
  }
};

export const seedCompanyPatterns = async (req, res) => {
  try {
    const companiesData = [
      {
        companyName: "Google",
        difficultyDistribution: { easy: 20, medium: 50, hard: 30 },
        typicalDuration: 90,
        topicWeights: {
          Array: 15,
          String: 12,
          DynamicProgramming: 15,
          Graph: 12,
          Tree: 10,
          BinarySearch: 8,
          Greedy: 8,
          Backtracking: 5,
          Math: 5,
          Hashing: 10,
        },
      },
      {
        companyName: "Amazon",
        difficultyDistribution: { easy: 25, medium: 55, hard: 20 },
        typicalDuration: 90,
        topicWeights: {
          Array: 18,
          String: 12,
          Tree: 12,
          Graph: 10,
          DynamicProgramming: 12,
          Heap: 8,
          Stack: 8,
          Queue: 6,
          Hashing: 8,
          TwoPointers: 6,
        },
      },
      {
        companyName: "Meta",
        difficultyDistribution: { easy: 15, medium: 55, hard: 30 },
        typicalDuration: 90,
        topicWeights: {
          Array: 14,
          String: 14,
          Graph: 15,
          DynamicProgramming: 12,
          Tree: 10,
          Backtracking: 8,
          BinarySearch: 7,
          TwoPointers: 8,
          SlidingWindow: 6,
          Recursion: 6,
        },
      },
      {
        companyName: "Microsoft",
        difficultyDistribution: { easy: 30, medium: 50, hard: 20 },
        typicalDuration: 60,
        topicWeights: {
          Array: 15,
          String: 15,
          Tree: 12,
          LinkedList: 10,
          Stack: 10,
          Queue: 8,
          DynamicProgramming: 8,
          Sorting: 8,
          Hashing: 8,
          BitManipulation: 6,
        },
      },
      {
        companyName: "Apple",
        difficultyDistribution: { easy: 25, medium: 50, hard: 25 },
        typicalDuration: 60,
        topicWeights: {
          Array: 15,
          String: 15,
          Tree: 12,
          DynamicProgramming: 10,
          LinkedList: 10,
          BinarySearch: 8,
          Stack: 8,
          Sorting: 8,
          Graph: 7,
          Heap: 7,
        },
      },
    ];

    for (const company of companiesData) {
      await CompanyOAPattern.findOneAndUpdate(
        { companyName: company.companyName },
        { ...company, isActive: true },
        { upsert: true }
      );
    }

    res.json({
      success: true,
      message: `Seeded ${companiesData.length} company patterns`,
    });
  } catch (error) {
    console.error("Error seeding company patterns:", error);
    res.status(500).json({
      success: false,
      error: "Failed to seed company patterns",
      message: error.message,
    });
  }
};
