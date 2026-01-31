import Question from "../../models/question/Question.js";
import { UserOAHistory } from "../../models/oa/index.js";

/**
 * Question Selection Engine
 * 
 * STRICT DATABASE-ONLY question selection for OA sessions.
 * 
 * Rules:
 * - NO fallback questions
 * - NO AI-generated questions
 * - NO hardcoded questions
 * - All questions MUST come from database
 * - Returns exact counts for proper HTTP status code handling
 */
class QuestionSelectionEngine {
  constructor() {
    // Topic name variations mapping (canonical -> all variations)
    this.TOPIC_VARIATIONS = {
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

    this.VALID_DIFFICULTIES = ["Easy", "Medium", "Hard"];
  }

  /**
   * Expand topic names to include all variations for database query
   */
  expandTopics(topics) {
    if (!topics || topics.length === 0) return [];
    
    const expanded = new Set();
    for (const topic of topics) {
      // Add the original topic
      expanded.add(topic);
      // Add all variations if it's a canonical name
      if (this.TOPIC_VARIATIONS[topic]) {
        this.TOPIC_VARIATIONS[topic].forEach(v => expanded.add(v));
      }
    }
    return [...expanded];
  }

  /**
   * Build MongoDB query criteria from config
   * @param {Object} config - Selection configuration
   * @returns {Object} MongoDB query criteria
   */
  buildCriteria(config) {
    const criteria = { isActive: true };

    const hasCompanies = config.companyMode === "selected" && config.selectedCompanies?.length > 0;

    // Filter by companies field (not tags - tags are for topics)
    // The Question schema has: companies: [String] - array of company names
    if (hasCompanies) {
      criteria.companies = { $in: config.selectedCompanies };
    }
    // If no companies selected, return all active questions (companyMode: "all")

    return criteria;
  }

  /**
   * Normalize difficulty string to proper case
   */
  normalizeDifficulty(difficulty) {
    const map = { easy: "Easy", medium: "Medium", hard: "Hard" };
    return map[difficulty?.toLowerCase()] || difficulty;
  }

  /**
   * Calculate difficulty distribution for mixed/adaptive modes
   */
  calculateDifficultyDistribution(config, userHistory) {
    const { difficulty } = config;

    if (difficulty === "adaptive") {
      return this.adaptiveDifficultyDistribution(userHistory);
    }

    if (difficulty === "mixed") {
      return { Easy: 30, Medium: 50, Hard: 20 };
    }

    // Single difficulty mode
    const normalized = this.normalizeDifficulty(difficulty);
    if (this.VALID_DIFFICULTIES.includes(normalized)) {
      return { [normalized]: 100 };
    }

    // Default to mixed
    return { Easy: 30, Medium: 50, Hard: 20 };
  }

  /**
   * Adaptive difficulty based on user performance
   */
  adaptiveDifficultyDistribution(userHistory) {
    if (!userHistory || userHistory.totalOAs < 3) {
      return { Easy: 30, Medium: 50, Hard: 20 };
    }

    const { difficultyProficiency } = userHistory;
    const easyRate = difficultyProficiency?.easy?.avgPassRate || 0.5;
    const medRate = difficultyProficiency?.medium?.avgPassRate || 0.5;
    const hardRate = difficultyProficiency?.hard?.avgPassRate || 0.5;

    if (hardRate > 0.7) {
      return { Easy: 10, Medium: 30, Hard: 60 };
    } else if (medRate > 0.7 && hardRate > 0.4) {
      return { Easy: 15, Medium: 45, Hard: 40 };
    } else if (medRate < 0.5) {
      return { Easy: 50, Medium: 40, Hard: 10 };
    }

    return { Easy: 25, Medium: 50, Hard: 25 };
  }

  /**
   * Calculate bucket counts from percentages
   */
  calculateBucketCounts(total, distribution) {
    const buckets = {};
    let assigned = 0;

    for (const [diff, pct] of Object.entries(distribution)) {
      const count = Math.round(total * (pct / 100));
      buckets[diff] = count;
      assigned += count;
    }

    // Handle rounding errors - add to Medium
    if (assigned < total) {
      buckets["Medium"] = (buckets["Medium"] || 0) + (total - assigned);
    } else if (assigned > total) {
      const largest = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0][0];
      buckets[largest] -= assigned - total;
    }

    return buckets;
  }

  /**
   * Get user's weak topics for weighted selection
   */
  getWeakTopics(userHistory) {
    if (!userHistory?.topicProficiency) return [];

    const weak = [];
    for (const [topic, stats] of userHistory.topicProficiency.entries()) {
      if (stats.avgPassRate < 0.5 && stats.attempted >= 2) {
        weak.push(topic);
      }
    }
    return weak;
  }

  /**
   * Fisher-Yates shuffle
   */
  shuffle(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * STRICT question selection - database only, no fallbacks
   * 
   * @param {Object} config - Selection configuration
   * @param {string} userId - User ID for history check
   * @param {number} requestedCount - Number of questions requested
   * @returns {Object} { questions: Array, totalAvailable: number, criteria: Object }
   */
  async selectQuestionsStrict(config, userId, requestedCount) {
    const startTime = Date.now();
    
    console.log("[QuestionSelection] Starting STRICT selection");
    console.log("[QuestionSelection] Config:", JSON.stringify(config, null, 2));
    console.log("[QuestionSelection] Requested count:", requestedCount);

    // Get user's history to avoid repeats
    const userHistory = await UserOAHistory.findOne({ userId });
    const attemptedIds = new Set(
      userHistory?.attemptedCoding?.map((c) => c.questionId.toString()) || []
    );

    console.log("[QuestionSelection] User has attempted:", attemptedIds.size, "questions");

    // Build base criteria
    const baseCriteria = this.buildCriteria(config);
    console.log("[QuestionSelection] Query criteria:", JSON.stringify(baseCriteria, null, 2));

    // Count total available questions (excluding attempted)
    const totalAvailableQuery = {
      ...baseCriteria,
      _id: { $nin: Array.from(attemptedIds) },
    };

    const totalAvailable = await Question.countDocuments(totalAvailableQuery);

    console.log("[QuestionSelection] Total available (excl. attempted):", totalAvailable);

    // If no questions available, return early with count
    if (totalAvailable === 0) {
      return {
        questions: [],
        totalAvailable: 0,
        criteria: {
          topics: config.selectedTopics || [],
          companies: config.selectedCompanies || [],
          difficulty: config.difficulty || "mixed",
          companyMode: config.companyMode || "all",
        },
      };
    }

    // Calculate difficulty distribution
    const difficultyDist = this.calculateDifficultyDistribution(config, userHistory);
    const buckets = this.calculateBucketCounts(requestedCount, difficultyDist);

    console.log("[QuestionSelection] Difficulty distribution:", difficultyDist);
    console.log("[QuestionSelection] Target buckets:", buckets);

    // Select questions by difficulty bucket
    const selected = [];
    const selectedIds = new Set();
    const weakTopics = this.getWeakTopics(userHistory);

    for (const [difficulty, bucketCount] of Object.entries(buckets)) {
      if (bucketCount === 0) continue;

      const bucketCriteria = {
        ...baseCriteria,
        difficulty,
        _id: { $nin: [...Array.from(attemptedIds), ...Array.from(selectedIds)] },
      };

      try {
        // Query with optional weak topic weighting
        let questions;

        if (weakTopics.length > 0) {
          // Weighted selection favoring weak topics
          questions = await Question.aggregate([
            { $match: bucketCriteria },
            {
              $addFields: {
                weight: {
                  $cond: {
                    if: {
                      $or: [
                        { $in: ["$topic", weakTopics] },
                        { $in: ["$categoryType", weakTopics] },
                      ],
                    },
                    then: 2,
                    else: 1,
                  },
                },
              },
            },
            { $sample: { size: Math.max(bucketCount * 3, 10) } },
            { $sort: { weight: -1 } },
            { $limit: bucketCount },
          ]);
        } else {
          // Simple random selection
          questions = await Question.aggregate([
            { $match: bucketCriteria },
            { $sample: { size: bucketCount } },
          ]);
        }

        console.log(`[QuestionSelection] ${difficulty}: found ${questions.length}/${bucketCount}`);

        for (const q of questions) {
          selected.push(q);
          selectedIds.add(q._id.toString());
        }
      } catch (error) {
        console.error(`[QuestionSelection] Error selecting ${difficulty}:`, error.message);
        // Don't swallow error silently - this is a DB issue
        throw new Error(`Database error while selecting ${difficulty} questions: ${error.message}`);
      }
    }

    // If we couldn't fill all buckets, try to fill remaining from any available
    // BUT only if we have at least some questions - NO FALLBACK TO FAKE DATA
    if (selected.length < requestedCount && selected.length > 0) {
      const remaining = requestedCount - selected.length;
      console.log(`[QuestionSelection] Need ${remaining} more questions from any difficulty`);

      const fillCriteria = {
        ...baseCriteria,
        _id: { $nin: [...Array.from(attemptedIds), ...Array.from(selectedIds)] },
      };

      const fillQuestions = await Question.aggregate([
        { $match: fillCriteria },
        { $sample: { size: remaining } },
      ]);

      console.log(`[QuestionSelection] Found ${fillQuestions.length} additional questions`);
      selected.push(...fillQuestions);
    }

    // Shuffle final selection and assign order
    const shuffled = this.shuffle(selected);
    const finalQuestions = shuffled.slice(0, requestedCount).map((q, idx) => ({
      ...q,
      order: idx,
    }));

    const duration = Date.now() - startTime;
    console.log(`[QuestionSelection] Selection complete in ${duration}ms`);
    console.log(`[QuestionSelection] Final selection: ${finalQuestions.length} questions`);
    console.log(`[QuestionSelection] Question IDs: ${finalQuestions.map(q => q._id).join(", ")}`);

    return {
      questions: finalQuestions,
      totalAvailable,
      criteria: {
        topics: config.selectedTopics || [],
        companies: config.selectedCompanies || [],
        difficulty: config.difficulty || "mixed",
        companyMode: config.companyMode || "all",
      },
    };
  }

  /**
   * Check availability without selecting
   * For pre-flight API
   */
  async checkAvailability(config, userId) {
    console.log("[QuestionSelection] Checking availability");

    // Get user's history
    const userHistory = await UserOAHistory.findOne({ userId });
    const attemptedIds = new Set(
      userHistory?.attemptedCoding?.map((c) => c.questionId.toString()) || []
    );

    const baseCriteria = this.buildCriteria(config);
    const excludeAttempted = { _id: { $nin: Array.from(attemptedIds) } };

    // Count by difficulty
    const byDifficulty = {};
    let total = 0;

    for (const difficulty of this.VALID_DIFFICULTIES) {
      const count = await Question.countDocuments({
        ...baseCriteria,
        ...excludeAttempted,
        difficulty,
      });
      byDifficulty[difficulty] = count;
      total += count;
    }

    return {
      total,
      byDifficulty,
      attemptedByUser: attemptedIds.size,
      criteria: {
        topics: config.selectedTopics || [],
        companies: config.selectedCompanies || [],
        difficulty: config.difficulty || "mixed",
        companyMode: config.companyMode || "all",
      },
    };
  }

  /**
   * Legacy method - wraps selectQuestionsStrict for backward compatibility
   * @deprecated Use selectQuestionsStrict instead
   */
  async selectQuestions(config, userId) {
    const count = config.questionCounts?.coding || 2;
    const result = await this.selectQuestionsStrict(config, userId, count);
    
    return {
      coding: result.questions,
    };
  }

  /**
   * Quick fight mode selection
   */
  async selectQuickFightQuestions(userId) {
    const defaultConfig = {
      companyMode: "all",
      selectedCompanies: [],
      selectedTopics: [],
      difficulty: "mixed",
      questionCounts: { coding: 2 },
    };

    return this.selectQuestionsStrict(defaultConfig, userId, 2);
  }
}

export default new QuestionSelectionEngine();
