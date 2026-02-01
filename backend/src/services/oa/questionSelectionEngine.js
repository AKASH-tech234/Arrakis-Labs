import Question from "../../models/question/Question.js";
import { UserOAHistory } from "../../models/oa/index.js";

class QuestionSelectionEngine {
  constructor() {

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

  expandTopics(topics) {
    if (!topics || topics.length === 0) return [];

    const expanded = new Set();
    for (const topic of topics) {

      expanded.add(topic);

      if (this.TOPIC_VARIATIONS[topic]) {
        this.TOPIC_VARIATIONS[topic].forEach(v => expanded.add(v));
      }
    }
    return [...expanded];
  }

  buildCriteria(config) {
    const criteria = { isActive: true };

    const hasCompanies = config.companyMode === "selected" && config.selectedCompanies?.length > 0;

    if (hasCompanies) {
      criteria.companies = { $in: config.selectedCompanies };
    }

    return criteria;
  }

  normalizeDifficulty(difficulty) {
    const map = { easy: "Easy", medium: "Medium", hard: "Hard" };
    return map[difficulty?.toLowerCase()] || difficulty;
  }

  calculateDifficultyDistribution(config, userHistory) {
    const { difficulty } = config;

    if (difficulty === "adaptive") {
      return this.adaptiveDifficultyDistribution(userHistory);
    }

    if (difficulty === "mixed") {
      return { Easy: 30, Medium: 50, Hard: 20 };
    }

    const normalized = this.normalizeDifficulty(difficulty);
    if (this.VALID_DIFFICULTIES.includes(normalized)) {
      return { [normalized]: 100 };
    }

    return { Easy: 30, Medium: 50, Hard: 20 };
  }

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

  calculateBucketCounts(total, distribution) {
    const buckets = {};
    let assigned = 0;

    for (const [diff, pct] of Object.entries(distribution)) {
      const count = Math.round(total * (pct / 100));
      buckets[diff] = count;
      assigned += count;
    }

    if (assigned < total) {
      buckets["Medium"] = (buckets["Medium"] || 0) + (total - assigned);
    } else if (assigned > total) {
      const largest = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0][0];
      buckets[largest] -= assigned - total;
    }

    return buckets;
  }

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

  shuffle(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  async selectQuestionsStrict(config, userId, requestedCount) {
    const startTime = Date.now();

    console.log("[QuestionSelection] Starting STRICT selection");
    console.log("[QuestionSelection] Config:", JSON.stringify(config, null, 2));
    console.log("[QuestionSelection] Requested count:", requestedCount);

    const userHistory = await UserOAHistory.findOne({ userId });
    const attemptedIds = new Set(
      userHistory?.attemptedCoding?.map((c) => c.questionId.toString()) || []
    );

    console.log("[QuestionSelection] User has attempted:", attemptedIds.size, "questions");

    const baseCriteria = this.buildCriteria(config);
    console.log("[QuestionSelection] Query criteria:", JSON.stringify(baseCriteria, null, 2));

    const totalAvailableQuery = {
      ...baseCriteria,
      _id: { $nin: Array.from(attemptedIds) },
    };

    const totalAvailable = await Question.countDocuments(totalAvailableQuery);

    console.log("[QuestionSelection] Total available (excl. attempted):", totalAvailable);

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

    const difficultyDist = this.calculateDifficultyDistribution(config, userHistory);
    const buckets = this.calculateBucketCounts(requestedCount, difficultyDist);

    console.log("[QuestionSelection] Difficulty distribution:", difficultyDist);
    console.log("[QuestionSelection] Target buckets:", buckets);

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

        let questions;

        if (weakTopics.length > 0) {

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

        throw new Error(`Database error while selecting ${difficulty} questions: ${error.message}`);
      }
    }

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

  async checkAvailability(config, userId) {
    console.log("[QuestionSelection] Checking availability");

    const userHistory = await UserOAHistory.findOne({ userId });
    const attemptedIds = new Set(
      userHistory?.attemptedCoding?.map((c) => c.questionId.toString()) || []
    );

    const baseCriteria = this.buildCriteria(config);
    const excludeAttempted = { _id: { $nin: Array.from(attemptedIds) } };

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

  async selectQuestions(config, userId) {
    const count = config.questionCounts?.coding || 2;
    const result = await this.selectQuestionsStrict(config, userId, count);

    return {
      coding: result.questions,
    };
  }

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
