/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PLAGIARISM DETECTION SERVICE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Main orchestration service for plagiarism detection.
 * Coordinates the full pipeline:
 * 1. Fetch submissions for a contest
 * 2. Preprocess code (normalize, tokenize)
 * 3. Build TF-IDF vectors per problem
 * 4. Compute pairwise similarities
 * 5. Cluster cheating groups using Union-Find
 * 6. Apply penalties and store results
 * 
 * Designed for scalability:
 * - Process problems in parallel
 * - Batch database operations
 * - Progress tracking and resumability
 */

import mongoose from "mongoose";
import { PlagiarismCheck, PlagiarismResult, CheatingGroup, ProcessedSubmission } from "../../models/plagiarism/index.js";
import ContestSubmission from "../../models/contest/ContestSubmission.js";
import ContestRegistration from "../../models/contest/ContestRegistration.js";
import Contest from "../../models/contest/Contest.js";
import { CodePreprocessor } from "./CodePreprocessor.js";
import { TFIDFVectorizer, BatchTFIDFVectorizer } from "./TFIDFVectorizer.js";
import SimilarityEngine from "./SimilarityEngine.js";
import UnionFind from "./UnionFind.js";

class PlagiarismDetectionService {
  constructor(options = {}) {
    this.options = {
      plagiarismThreshold: 0.80,
      reviewThreshold: 0.60,
      minSubmissionLength: 50,
      batchSize: 100,
      parallelProblems: 3,
      ...options,
    };

    this.preprocessor = new CodePreprocessor();
    this.batchVectorizer = new BatchTFIDFVectorizer();
    this.similarityEngine = new SimilarityEngine();
  }

  /**
   * Main entry point: run plagiarism detection for a contest
   */
  async runDetection(contestId, options = {}) {
    const config = { ...this.options, ...options };
    let plagiarismCheck;

    console.log(`\n${'═'.repeat(70)}`);
    console.log(`🔍 PLAGIARISM DETECTION STARTED`);
    console.log(`   Contest ID: ${contestId}`);
    console.log(`   Timestamp: ${new Date().toISOString()}`);
    console.log(`   Config: threshold=${config.plagiarismThreshold}, review=${config.reviewThreshold}`);
    console.log(`${'═'.repeat(70)}\n`);

    try {
      // Get or create plagiarism check record
      console.log(`📋 Step 0: Getting/creating plagiarism check record...`);
      plagiarismCheck = await PlagiarismCheck.getOrCreateForContest(contestId);
      console.log(`   ✓ PlagiarismCheck record: ${plagiarismCheck._id} (status: ${plagiarismCheck.status})`);
      
      if (plagiarismCheck.status === "completed") {
        console.log(`Plagiarism check already completed for contest ${contestId}`);
        return plagiarismCheck;
      }

      // Update config
      plagiarismCheck.config = {
        plagiarismThreshold: config.plagiarismThreshold,
        reviewThreshold: config.reviewThreshold,
      };
      await PlagiarismCheck.updateOne(
        { _id: plagiarismCheck._id },
        {
          $set: {
            config: plagiarismCheck.config,
          },
        }
      );

      // Get contest and validate
      const contest = await Contest.findById(contestId);
      if (!contest) {
        throw new Error(`Contest not found: ${contestId}`);
      }

      // Lock contest for plagiarism check
      if (contest.status !== "ended" && contest.status !== "locked") {
        throw new Error(`Contest must be ended before plagiarism check. Current status: ${contest.status}`);
      }

      console.log(`\n📊 Contest: ${contest.name || contest.title}`);
      console.log(`   Status: ${contest.status}`);

      // If there are no accepted submissions, complete immediately.
      const acceptedSubmissionCount = await ContestSubmission.countDocuments({
        contest: contestId,
        verdict: "accepted",
      });
      console.log(`   Accepted submissions: ${acceptedSubmissionCount}`);

      if (acceptedSubmissionCount === 0) {
        console.log(`\n⚠️  No accepted submissions found. Completing early.`);
        await PlagiarismCheck.updateOne(
          { _id: plagiarismCheck._id },
          {
            $set: {
              "progress.totalSubmissions": 0,
              "progress.processedSubmissions": 0,
              "progress.totalComparisons": 0,
              "progress.completedComparisons": 0,
            },
          }
        );

        const results = await this.generateSummary(contestId);
        await plagiarismCheck.markCompleted(results);
        console.log(`✅ Plagiarism detection completed for contest ${contestId} (no accepted submissions)\n`);
        return plagiarismCheck;
      }

      // Phase 1: Preprocessing
      console.log(`\n${'─'.repeat(50)}`);
      console.log(`🛠️  PHASE 1: PREPROCESSING`);
      console.log(`${'─'.repeat(50)}`);
      await plagiarismCheck.markPhase("preprocessing");
      await this.preprocessSubmissions(contestId, plagiarismCheck);
      console.log(`✓ Phase 1 complete`);

      // Phase 2: Vectorization
      console.log(`\n${'─'.repeat(50)}`);
      console.log(`📊 PHASE 2: VECTORIZATION (TF-IDF)`);
      console.log(`${'─'.repeat(50)}`);
      await plagiarismCheck.markPhase("vectorizing");
      await this.vectorizeSubmissions(contestId, plagiarismCheck);
      console.log(`✓ Phase 2 complete`);

      // Phase 3: Similarity Comparison
      console.log(`\n${'─'.repeat(50)}`);
      console.log(`🔍 PHASE 3: SIMILARITY COMPARISON`);
      console.log(`${'─'.repeat(50)}`);
      await plagiarismCheck.markPhase("comparing");
      await this.compareSubmissions(contestId, plagiarismCheck, config);
      console.log(`✓ Phase 3 complete`);

      // Phase 4: Clustering
      console.log(`\n${'─'.repeat(50)}`);
      console.log(`👥 PHASE 4: CLUSTERING CHEATERS`);
      console.log(`${'─'.repeat(50)}`);
      await plagiarismCheck.markPhase("clustering");
      await this.clusterCheaters(contestId, plagiarismCheck);
      console.log(`✓ Phase 4 complete`);

      // Phase 5: Apply Penalties
      console.log(`\n${'─'.repeat(50)}`);
      console.log(`⚡ PHASE 5: APPLYING PENALTIES`);
      console.log(`${'─'.repeat(50)}`);
      await plagiarismCheck.markPhase("applying_penalties");
      await this.applyPenalties(contestId, plagiarismCheck);
      console.log(`✓ Phase 5 complete`);

      // Mark completed
      console.log(`\n${'─'.repeat(50)}`);
      console.log(`📝 GENERATING SUMMARY`);
      console.log(`${'─'.repeat(50)}`);
      const results = await this.generateSummary(contestId);
      await plagiarismCheck.markCompleted(results);

      console.log(`\n${'═'.repeat(70)}`);
      console.log(`✅ PLAGIARISM DETECTION COMPLETED`);
      console.log(`   Contest: ${contestId}`);
      console.log(`   Total submissions: ${results.totalSubmissions}`);
      console.log(`   Flagged users: ${results.flaggedUsers}`);
      console.log(`   Cheating groups: ${results.totalGroups}`);
      console.log(`${'═'.repeat(70)}\n`);

      return plagiarismCheck;

    } catch (error) {
      console.error(`\n${'═'.repeat(70)}`);
      console.error(`❌ PLAGIARISM DETECTION FAILED`);
      console.error(`   Error: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
      console.error(`${'═'.repeat(70)}\n`);
      if (plagiarismCheck) {
        await plagiarismCheck.markFailed(error.message);
      }
      throw error;
    }
  }

  /**
   * Phase 1: Preprocess all submissions
   */
  async preprocessSubmissions(contestId, plagiarismCheck) {
    console.log(`   📂 Fetching accepted submissions...`);

    // Get all accepted submissions (only check accepted solutions)
    const submissions = await ContestSubmission.find({
      contest: contestId,
      verdict: "accepted",
    }).select("_id user problem code language contest");

    await PlagiarismCheck.updateOne(
      { _id: plagiarismCheck._id },
      { $set: { "progress.totalSubmissions": submissions.length } }
    );
    plagiarismCheck.progress.totalSubmissions = submissions.length;

    console.log(`   📊 Found ${submissions.length} accepted submissions to preprocess`);

    let processed = 0;
    let skipped = 0;
    const batchSize = this.options.batchSize;

    for (let i = 0; i < submissions.length; i += batchSize) {
      const batch = submissions.slice(i, i + batchSize);
      const processedDocs = [];

      for (const submission of batch) {
        // Check if already processed
        const existing = await ProcessedSubmission.findOne({ submission: submission._id });
        if (existing) {
          processed++;
          continue;
        }

        // Preprocess code
        const result = this.preprocessor.processForPlagiarismDetection(
          submission.code,
          submission.language
        );

        const doc = {
          submission: submission._id,
          contest: contestId,
          problem: submission.problem,
          user: submission.user,
          originalLength: result.originalLength || submission.code.length,
          language: submission.language,
          processedContent: result.processed,
          processedLength: result.processedLength || 0,
          tokens: result.tokens,
          tokenCount: result.tokenCount || 0,
          ngrams: result.ngrams,
          isTooShort: result.isTooShort || false,
          isBoilerplate: result.isBoilerplate || false,
          processingError: result.error,
        };

        processedDocs.push(doc);
        processed++;
      }

      // Bulk insert
      if (processedDocs.length > 0) {
        await ProcessedSubmission.insertMany(processedDocs, { ordered: false })
          .catch((err) => {
            // Ignore duplicate key errors
            if (err.code !== 11000) throw err;
          });
      }

      // Update progress
      plagiarismCheck.progress.processedSubmissions = processed;
      await PlagiarismCheck.updateOne(
        { _id: plagiarismCheck._id },
        { $set: { "progress.processedSubmissions": processed } }
      );
    }

    console.log(`   ✓ Preprocessed ${processed} submissions (${skipped} already cached)`);
  }

  /**
   * Phase 2: Build TF-IDF vectors per problem
   */
  async vectorizeSubmissions(contestId, plagiarismCheck) {
    // Get unique problems in contest
    const problems = await ProcessedSubmission.distinct("problem", { contest: contestId });
    console.log(`   📊 Found ${problems.length} unique problems to vectorize`);

    let totalVectorized = 0;

    for (const problemId of problems) {
      // Get processed submissions for this problem
      const submissions = await ProcessedSubmission.find({
        contest: contestId,
        problem: problemId,
        isTooShort: false,
        isBoilerplate: false,
        processingError: { $exists: false },
      });

      if (submissions.length < 2) {
        console.log(`   ⚠️  Skipping problem ${problemId.toString().slice(-6)}: only ${submissions.length} valid submissions`);
        continue;
      }

      console.log(`   🔢 Problem ${problemId.toString().slice(-6)}: vectorizing ${submissions.length} submissions...`);

      // Build vectorizer for this problem
      const tokenArrays = submissions.map((s) => ({
        submissionId: s.submission,
        userId: s.user,
        tokens: s.tokens,
      }));

      const vectorizer = new TFIDFVectorizer();
      const allTokens = tokenArrays.map((t) => t.tokens);
      vectorizer.fit(allTokens);

      // FIX SCALE-003: Transform and save vectors using bulkWrite instead of individual updates
      const bulkOps = submissions.map((sub) => {
        const vector = vectorizer.transform(sub.tokens);
        const magnitude = vectorizer.magnitude(vector);

        return {
          updateOne: {
            filter: { _id: sub._id },
            update: {
              $set: {
                tfidfVector: vector,
                vectorMagnitude: magnitude,
                vocabSize: vectorizer.vocabulary.size,
              },
            },
          },
        };
      });

      if (bulkOps.length > 0) {
        await ProcessedSubmission.bulkWrite(bulkOps, { ordered: false });
      }

      // FIX: Use atomic update to avoid validation issues with problemStatuses
      // Check if problem status exists
      const existingIdx = plagiarismCheck.problemStatuses.findIndex(
        (ps) => ps.problem.toString() === problemId.toString()
      );
      
      if (existingIdx >= 0) {
        // Update existing entry using atomic operation
        await PlagiarismCheck.updateOne(
          { _id: plagiarismCheck._id, "problemStatuses.problem": problemId },
          {
            $set: {
              "problemStatuses.$.status": "comparing",
              "problemStatuses.$.submissionCount": submissions.length,
            },
          }
        );
      } else {
        // Push new entry using atomic operation with all required fields
        await PlagiarismCheck.updateOne(
          { _id: plagiarismCheck._id },
          {
            $push: {
              problemStatuses: {
                problem: problemId,
                problemLabel: `Problem ${problemId.toString().slice(-6)}`,
                status: "comparing",
                submissionCount: submissions.length,
                comparisonCount: 0,
                plagiarismCount: 0,
                reviewCount: 0,
                safeCount: 0,
              },
            },
          }
        );
      }

      // Reload plagiarismCheck to get updated problemStatuses
      const updatedCheck = await PlagiarismCheck.findById(plagiarismCheck._id);
      if (updatedCheck) {
        plagiarismCheck.problemStatuses = updatedCheck.problemStatuses;
      }

      totalVectorized += submissions.length;
      console.log(`      ✓ Vectorized with vocabulary size: ${vectorizer.vocabulary.size}`);
    }

    console.log(`   ✓ Total vectorized: ${totalVectorized} submissions across ${problems.length} problems`);
  }

  /**
   * Phase 3: Compare all pairs and find similar submissions
   */
  async compareSubmissions(contestId, plagiarismCheck, config) {
    const problems = await ProcessedSubmission.distinct("problem", { contest: contestId });
    let totalComparisons = 0;
    let completedComparisons = 0;

    // Calculate total comparisons
    for (const problemId of problems) {
      const count = await ProcessedSubmission.countDocuments({
        contest: contestId,
        problem: problemId,
        isTooShort: false,
        isBoilerplate: false,
        processingError: { $exists: false },
        tfidfVector: { $exists: true },
      });
      totalComparisons += (count * (count - 1)) / 2; // n choose 2
    }

    console.log(`   📊 Total pairwise comparisons to make: ${totalComparisons}`);

    // Use atomic update here to avoid `.save()` failing due to legacy invalid subdocs.
    await PlagiarismCheck.updateOne(
      { _id: plagiarismCheck._id },
      { $set: { "progress.totalComparisons": totalComparisons } }
    );
    plagiarismCheck.progress.totalComparisons = totalComparisons;

    if (totalComparisons === 0) {
      console.log(
        `   ⚠️  No comparable pairs found (need >=2 valid, non-boilerplate submissions per problem). Skipping comparison phase.`
      );
      await PlagiarismCheck.updateOne(
        { _id: plagiarismCheck._id },
        { $set: { "progress.completedComparisons": 0 } }
      );
      plagiarismCheck.progress.completedComparisons = 0;
      return;
    }

    let totalFlagged = 0;

    // Process each problem
    for (const problemId of problems) {
      const submissions = await ProcessedSubmission.find({
        contest: contestId,
        problem: problemId,
        isTooShort: false,
        isBoilerplate: false,
        processingError: { $exists: false },
        tfidfVector: { $exists: true },
      }).lean();

      if (submissions.length < 2) {
        console.log(`   ⚠️  Problem ${problemId.toString().slice(-6)}: skipping (< 2 submissions)`);
        continue;
      }

      console.log(`   🔍 Problem ${problemId.toString().slice(-6)}: comparing ${submissions.length} submissions...`);

      // Convert to comparison format
      const compareData = submissions.map((s) => ({
        submissionId: s.submission,
        userId: s.user,
        vector: s.tfidfVector instanceof Map ? s.tfidfVector : new Map(Object.entries(s.tfidfVector || {})),
        tokens: s.tokens,
        ngrams: s.ngrams,
      }));

      // Compare all pairs
      const results = this.similarityEngine.compareAllPairs(
        compareData,
        config.reviewThreshold,
        true // use quick filter
      );

      // Batch fetch original submissions for matching sections (SCALABILITY FIX)
      const submissionIds = [...new Set(results.flatMap(r => [r.submission1, r.submission2]))];
      const originalSubmissions = await ContestSubmission.find({
        _id: { $in: submissionIds }
      }).select("_id code").lean();
      const codeMap = new Map(originalSubmissions.map(s => [s._id.toString(), s.code]));

      // Store results
      const plagiarismResults = [];
      for (const result of results) {
        // Determine status based on thresholds
        let status = "safe";
        if (result.score >= config.plagiarismThreshold) {
          status = "plagiarism";
        } else if (result.score >= config.reviewThreshold) {
          status = "review";
        }

        // Get original code for matching sections from cache
        const code1 = codeMap.get(result.submission1.toString());
        const code2 = codeMap.get(result.submission2.toString());

        let matchingSections = [];
        if (status !== "safe" && code1 && code2) {
          matchingSections = this.similarityEngine.findMatchingSections(code1, code2);
        }

        plagiarismResults.push({
          plagiarismCheck: plagiarismCheck._id, // FIX: Add required field
          contest: contestId,
          problem: problemId,
          submission1: result.submission1,
          submission2: result.submission2,
          user1: result.user1,
          user2: result.user2,
          similarityScore: result.score,
          similarityDetails: {
            cosineSimilarity: result.metrics.cosine,
            jaccardSimilarity: result.metrics.jaccard,
            levenshteinRatio: result.metrics.levenshtein,
            tokenOverlap: result.metrics.tokenOverlap,
            structuralSimilarity: result.metrics.structural,
          },
          status,
          matchingSections,
          comparedAt: new Date(),
        });
      }

      // Bulk insert results
      if (plagiarismResults.length > 0) {
        await PlagiarismResult.insertMany(plagiarismResults, { ordered: false })
          .catch((err) => {
            if (err.code !== 11000) throw err; // Ignore duplicates
          });
      }

      completedComparisons += (submissions.length * (submissions.length - 1)) / 2;
      plagiarismCheck.progress.completedComparisons = completedComparisons;
      
      // Update problem status using atomic operations to avoid validation errors
      const flaggedCount = plagiarismResults.filter((r) => r.status !== "safe").length;
      const plagiarismCount = plagiarismResults.filter(r => r.status === "plagiarism").length;
      const reviewCount = plagiarismResults.filter(r => r.status === "review").length;
      const safeCount = plagiarismResults.filter(r => r.status === "safe").length;
      
      // Check if problem status already exists
      const existingStatus = plagiarismCheck.problemStatuses.find(
        ps => ps.problem?.toString() === problemId.toString()
      );
      
      if (existingStatus) {
        // Update existing problem status atomically
        await PlagiarismCheck.updateOne(
          { _id: plagiarismCheck._id, "problemStatuses.problem": problemId },
          {
            $set: {
              "problemStatuses.$.status": "completed",
              "problemStatuses.$.comparisonCount": (submissions.length * (submissions.length - 1)) / 2,
              "problemStatuses.$.plagiarismCount": plagiarismCount,
              "problemStatuses.$.reviewCount": reviewCount,
              "problemStatuses.$.safeCount": safeCount,
              "problemStatuses.$.completedAt": new Date(),
              "progress.completedComparisons": completedComparisons,
            },
          }
        );
      } else {
        // Push new problem status atomically
        await PlagiarismCheck.updateOne(
          { _id: plagiarismCheck._id },
          {
            $push: {
              problemStatuses: {
                problem: problemId,
                problemLabel: `Problem ${problemId.toString().slice(-6)}`,
                submissionCount: submissions.length,
                comparisonCount: (submissions.length * (submissions.length - 1)) / 2,
                plagiarismCount,
                reviewCount,
                safeCount,
                status: "completed",
                completedAt: new Date(),
              },
            },
            $set: {
              "progress.completedComparisons": completedComparisons,
            },
          }
        );
      }

      // Reload plagiarismCheck to sync state
      const updatedCheck = await PlagiarismCheck.findById(plagiarismCheck._id);
      if (updatedCheck) {
        plagiarismCheck.problemStatuses = updatedCheck.problemStatuses;
        plagiarismCheck.progress = updatedCheck.progress;
      }

      totalFlagged += flaggedCount;
      console.log(`      ✓ Comparisons: ${(submissions.length * (submissions.length - 1)) / 2}, Flagged: ${flaggedCount} (${plagiarismCount} plagiarism, ${reviewCount} review)`);
    }

    console.log(`   ✓ Total comparisons: ${completedComparisons}, Total flagged: ${totalFlagged}`);
  }

  /**
   * Phase 4: Cluster cheaters using Union-Find
   */
  async clusterCheaters(contestId, plagiarismCheck) {
    // Get all plagiarism results (excluding safe)
    const results = await PlagiarismResult.find({
      contest: contestId,
      status: { $in: ["plagiarism", "review"] },
    });

    console.log(`   📊 Found ${results.length} flagged pairs to cluster`);

    if (results.length === 0) {
      console.log(`   ⚠️  No plagiarism detected, skipping clustering`);
      return;
    }

    // Build Union-Find structure
    console.log(`   🔗 Building Union-Find structure...`);
    const uf = new UnionFind();

    for (const result of results) {
      const user1 = result.user1.toString();
      const user2 = result.user2.toString();

      uf.union(user1, user2, {
        similarity: result.similarityScore,
        problem: result.problem.toString(),
        status: result.status,
        resultId: result._id,
      });
    }

    // Get all groups (sets with 2+ members)
    const groups = uf.getGroupDetails();

    console.log(`   👥 Found ${groups.length} cheating groups`);

    // Store groups
    for (const group of groups) {
      const groupId = await CheatingGroup.generateGroupId(contestId);
      console.log(`   📝 Creating group ${groupId} with ${group.members.length} members...`);

      // Get affected problems and plagiarism results for each member
      const memberDetails = await Promise.all(
        group.members.map(async (member) => {
          const userResults = await PlagiarismResult.find({
            contest: contestId,
            $or: [{ user1: member.id }, { user2: member.id }],
            status: { $in: ["plagiarism", "review"] },
          });

          // Build affected problems with details
          const affectedProblemsMap = new Map();
          for (const r of userResults) {
            const problemKey = r.problem.toString();
            if (!affectedProblemsMap.has(problemKey)) {
              affectedProblemsMap.set(problemKey, {
                problem: r.problem,
                problemLabel: `Problem`,
                similarityScore: r.similarityScore,
              });
            } else {
              // Keep the highest similarity score
              const existing = affectedProblemsMap.get(problemKey);
              if (r.similarityScore > existing.similarityScore) {
                existing.similarityScore = r.similarityScore;
              }
            }
          }

          // Calculate max similarity
          const maxSimilarity = userResults.length > 0
            ? Math.max(...userResults.map(r => r.similarityScore))
            : 0;

          return {
            user: new mongoose.Types.ObjectId(member.id),
            connectionCount: member.connectionCount,
            avgSimilarity: member.avgSimilarity,
            maxSimilarity,
            affectedProblems: Array.from(affectedProblemsMap.values()),
            penaltyStatus: "pending",
          };
        })
      );

      // Get all plagiarism result IDs for this group
      const groupResultIds = group.edges
        .filter(e => e.resultId)
        .map(e => e.resultId);

      // Calculate group-level statistics
      const avgGroupSimilarity = group.avgSimilarity;
      const affectedProblemsSet = new Set();
      memberDetails.forEach(m => {
        m.affectedProblems.forEach(ap => {
          affectedProblemsSet.add(ap.problem.toString());
        });
      });

      const cheatingGroup = new CheatingGroup({
        plagiarismCheck: plagiarismCheck._id, // FIX: Add required field
        groupId,
        contest: contestId,
        members: memberDetails,
        memberCount: memberDetails.length,
        internalPairCount: group.totalConnections,
        avgGroupSimilarity,
        affectedProblems: Array.from(affectedProblemsSet).map(pId => ({
          problem: new mongoose.Types.ObjectId(pId),
          problemLabel: `Problem`,
          pairCount: group.edges.filter(e => e.problem === pId).length,
          avgSimilarity: group.edges.filter(e => e.problem === pId).length > 0
            ? group.edges.filter(e => e.problem === pId).reduce((sum, e) => sum + (e.similarity || 0), 0) / group.edges.filter(e => e.problem === pId).length
            : 0,
        })),
        plagiarismResults: groupResultIds,
        detectedAt: new Date(),
        status: "detected",
      });

      await cheatingGroup.save();
      console.log(`      ✓ Created group ${groupId}: ${memberDetails.length} members, avgSim=${avgGroupSimilarity.toFixed(2)}`);
    }

    console.log(`   ✓ Created ${groups.length} cheating groups`);
  }

  /**
   * Phase 5: Apply penalties based on plagiarism severity
   */
  async applyPenalties(contestId, plagiarismCheck) {
    // FIX: Query for groups with status "detected" (not "pending" which is not in schema)
    const groups = await CheatingGroup.find({
      contest: contestId,
      status: "detected",
    });

    console.log(`   📋 Found ${groups.length} groups to penalize`);

    if (groups.length === 0) {
      console.log(`   ⚠️  No groups to penalize`);
      return;
    }

    let totalPenalized = 0;

    for (const group of groups) {
      console.log(`   ⚡ Processing group ${group.groupId}...`);
      
      // Apply penalty to each member
      for (const member of group.members) {
        // Update contest registration
        await ContestRegistration.findOneAndUpdate(
          { contest: contestId, user: member.user },
          {
            $set: {
              "disqualified.status": true,
              "disqualified.reason": `Plagiarism detected (Group: ${group.groupId}, Severity: ${group.severity})`,
              "disqualified.at": new Date(),
            },
          }
        );

        // Get affected problem IDs from the affectedProblems array
        const affectedProblemIds = member.affectedProblems.map(ap => ap.problem);

        // Flag submissions
        await ContestSubmission.updateMany(
          {
            contest: contestId,
            user: member.user,
            problem: { $in: affectedProblemIds },
          },
          {
            $set: {
              "flags.possiblePlagiarism": true,
              "flags.similarityScore": member.avgSimilarity,
            },
          }
        );

        // FIX: Use valid penaltyStatus enum value from schema
        member.penaltyStatus = "disqualified";
        totalPenalized++;
      }

      // FIX: Use valid status enum value ("confirmed" instead of "penalties_applied")
      group.status = "confirmed";
      group.penaltyAppliedAt = new Date();
      await group.save();

      console.log(`      ✓ Group ${group.groupId}: ${group.members.length} members penalized`);
    }

    console.log(`   ✓ Applied penalties to ${totalPenalized} users across ${groups.length} groups`);
  }

  /**
   * Generate summary statistics
   */
  async generateSummary(contestId) {
    console.log(`   📊 Generating summary statistics...`);
    
    const totalSubmissions = await ContestSubmission.countDocuments({
      contest: contestId,
      verdict: "accepted",
    });

    const flaggedSubmissions = await ContestSubmission.countDocuments({
      contest: contestId,
      "flags.possiblePlagiarism": true,
    });

    const totalUsers = await ContestSubmission.distinct("user", { contest: contestId });
    
    const flaggedUsers = await ContestRegistration.countDocuments({
      contest: contestId,
      "disqualified.status": true,
    });

    const totalGroups = await CheatingGroup.countDocuments({ contest: contestId });

    const summary = await PlagiarismResult.getContestSummary(contestId);

    const getStatusCount = (statusKey) => {
      if (Array.isArray(summary)) {
        return summary.find((s) => s?._id === statusKey)?.count || 0;
      }
      return summary?.[statusKey]?.count || 0;
    };

    console.log(`   ✓ Summary: ${totalSubmissions} submissions, ${flaggedUsers} flagged users, ${totalGroups} groups`);

    return {
      totalSubmissions,
      flaggedSubmissions,
      totalUsers: totalUsers.length,
      flaggedUsers,
      totalGroups,
      byStatus: {
        plagiarism: getStatusCount("plagiarism"),
        review: getStatusCount("review"),
        safe: getStatusCount("safe"),
      },
    };
  }

  /**
   * Get detailed results for a contest
   */
  async getContestResults(contestId) {
    const check = await PlagiarismCheck.findOne({ contest: contestId })
      .populate("contest", "title");

    const groups = await CheatingGroup.find({ contest: contestId })
      .populate("members.user", "name email username")
      .sort({ severity: -1 });

    const results = await PlagiarismResult.find({
      contest: contestId,
      status: { $ne: "safe" },
    })
      .populate("user1", "name email username")
      .populate("user2", "name email username")
      .populate("problem", "title")
      .sort({ similarityScore: -1 });

    return { check, groups, results };
  }

  /**
   * Re-run detection for a specific problem
   */
  async rerunForProblem(contestId, problemId) {
    // Clear existing results for this problem
    await PlagiarismResult.deleteMany({ contest: contestId, problem: problemId });
    await ProcessedSubmission.deleteMany({ contest: contestId, problem: problemId });

    // Run detection just for this problem
    const check = await PlagiarismCheck.findOne({ contest: contestId });
    if (check) {
      // FIX BUG-003: Use problemStatuses array instead of Map
      const existingIdx = check.problemStatuses.findIndex(
        (ps) => ps.problem.toString() === problemId.toString()
      );
      if (existingIdx >= 0) {
        check.problemStatuses[existingIdx].status = "pending";
      } else {
        check.problemStatuses.push({
          problem: problemId,
          problemLabel: `Problem ${problemId.toString().slice(-6)}`,
          status: "pending",
        });
      }
      await check.save();
    }

    // Re-run preprocessing and comparison
    await this.preprocessSubmissions(contestId, check);
    await this.vectorizeSubmissions(contestId, check);
    await this.compareSubmissions(contestId, check, this.options);
  }
}

export default PlagiarismDetectionService;
