/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PLAGIARISM JOB RUNNER
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Background job processor for plagiarism detection.
 * - Polls for pending jobs
 * - Processes contests asynchronously
 * - Handles retries and failures
 * - Provides job status monitoring
 */

import { PlagiarismCheck } from "../../models/plagiarism/index.js";
import PlagiarismDetectionService from "./PlagiarismDetectionService.js";

class PlagiarismJobRunner {
  constructor(options = {}) {
    this.options = {
      pollInterval: 30000, // 30 seconds
      maxConcurrent: 1, // Process one contest at a time
      maxRetries: 3,
      retryDelay: 60000, // 1 minute
      ...options,
    };

    this.detectionService = new PlagiarismDetectionService();
    this.isRunning = false;
    this.pollTimer = null;
    this.activeJobs = new Map();
  }

  /**
   * Start the job runner
   */
  start() {
    if (this.isRunning) {
      console.log("Plagiarism job runner already running");
      return;
    }

    this.isRunning = true;
    console.log("Starting plagiarism job runner...");
    this.poll();
  }

  /**
   * Stop the job runner
   */
  stop() {
    this.isRunning = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    console.log("Plagiarism job runner stopped");
  }

  /**
   * Poll for pending jobs
   */
  async poll() {
    if (!this.isRunning) return;

    try {
      await this.processPendingJobs();
    } catch (error) {
      console.error("Error polling for plagiarism jobs:", error);
    }

    // Schedule next poll
    this.pollTimer = setTimeout(() => this.poll(), this.options.pollInterval);
  }

  /**
   * Process all pending jobs
   */
  async processPendingJobs() {
    // Check if we have capacity
    if (this.activeJobs.size >= this.options.maxConcurrent) {
      return;
    }

    // Get pending jobs
    const pendingJobs = await PlagiarismCheck.getPendingJobs();

    for (const job of pendingJobs) {
      if (this.activeJobs.size >= this.options.maxConcurrent) {
        break;
      }

      if (!this.activeJobs.has(job.contest.toString())) {
        this.processJob(job);
      }
    }
  }

  /**
   * Process a single job
   */
  async processJob(job) {
    const contestId = job.contest.toString();
    this.activeJobs.set(contestId, job);

    console.log(`Starting plagiarism detection for contest: ${contestId}`);

    try {
      // Mark as queued (atomic update to avoid version conflicts)
      await PlagiarismCheck.updateOne(
        { _id: job._id },
        {
          $set: {
            status: "queued",
            startedAt: new Date(),
            error: null,
          },
        }
      );

      // Run detection
      await this.detectionService.runDetection(contestId);

      console.log(`Completed plagiarism detection for contest: ${contestId}`);
    } catch (error) {
      console.error(`Failed plagiarism detection for contest ${contestId}:`, error);

      const errorMessage = error?.message || String(error);

      // Handle retry (atomic update to avoid version conflicts)
      const updatedJob = await PlagiarismCheck.findOneAndUpdate(
        { _id: job._id },
        {
          $inc: { retryCount: 1 },
          $set: {
            status: "pending",
            error: errorMessage,
          },
        },
        { new: true }
      );

      const retryCount = updatedJob?.retryCount || 0;
      if (retryCount < this.options.maxRetries) {
        console.log(`Scheduling retry ${retryCount}/${this.options.maxRetries} for contest ${contestId}`);
      } else {
        await PlagiarismCheck.updateOne(
          { _id: job._id },
          {
            $set: {
              status: "failed",
              completedAt: new Date(),
              error: errorMessage,
            },
            $push: {
              errors: {
                phase: "job_runner",
                message: errorMessage,
                timestamp: new Date(),
              },
            },
          }
        );
        console.error(`Max retries exceeded for contest ${contestId}`);
      }
    } finally {
      this.activeJobs.delete(contestId);
    }
  }

  /**
   * Queue a new plagiarism check
   */
  async queueContest(contestId, options = {}) {
    let job = await PlagiarismCheck.getOrCreateForContest(contestId);

    const shouldForceReset = Boolean(options.force);

    // If the previous run failed/cancelled, we must reset to a pending state,
    // otherwise getPendingJobs() will never pick it up again.
    if (job.status === "failed" || job.status === "cancelled") {
      if (!shouldForceReset) {
        // Treat a queue request for a failed job as a retry.
        console.log(`Re-queuing failed plagiarism check for contest ${contestId}`);
      }

      const now = new Date();
      await PlagiarismCheck.updateOne(
        { _id: job._id },
        {
          $set: {
            status: "pending",
            queuedAt: now,
            "progress.currentPhase": "pending",
            error: null,
            completedAt: null,
          },
        }
      );
      job = await PlagiarismCheck.findById(job._id);
    }

    if (job.status === "completed") {
      if (shouldForceReset) {
        // Reset and re-queue (atomic update so legacy invalid subdocs don't block)
        const now = new Date();
        await PlagiarismCheck.updateOne(
          { _id: job._id },
          {
            $set: {
              status: "pending",
              queuedAt: now,
              retryCount: 0,
              progress: {
                currentPhase: "pending",
                totalSubmissions: 0,
                processedSubmissions: 0,
                totalComparisons: 0,
                completedComparisons: 0,
                percentComplete: 0,
              },
              results: null,
              error: null,
              completedAt: null,
            },
          }
        );
        job = await PlagiarismCheck.findById(job._id);
        console.log(`Re-queued plagiarism check for contest ${contestId}`);
      } else {
        console.log(`Plagiarism check already completed for contest ${contestId}`);
        return job;
      }
    }

    // If force=true, reset even if the job isn't completed (e.g. stuck/running/queued) so we get a clean rerun.
    if (shouldForceReset && job.status !== "pending") {
      const now = new Date();
      await PlagiarismCheck.updateOne(
        { _id: job._id },
        {
          $set: {
            status: "pending",
            queuedAt: now,
            retryCount: 0,
            "progress.currentPhase": "pending",
            "progress.totalSubmissions": 0,
            "progress.processedSubmissions": 0,
            "progress.totalComparisons": 0,
            "progress.completedComparisons": 0,
            "progress.percentComplete": 0,
            results: null,
            error: null,
            startedAt: null,
            completedAt: null,
          },
        }
      );
      job = await PlagiarismCheck.findById(job._id);
    }

    // Ensure queuedAt is set for correct ordering
    if (!job.queuedAt) {
      const now = new Date();
      await PlagiarismCheck.updateOne({ _id: job._id }, { $set: { queuedAt: now } });
      job.queuedAt = now;
    }

    // Trigger immediate poll if runner is active
    if (this.isRunning && this.activeJobs.size < this.options.maxConcurrent) {
      setImmediate(() => this.processPendingJobs());
    }

    return job;
  }

  /**
   * Get job status
   */
  async getJobStatus(contestId) {
    const job = await PlagiarismCheck.findOne({ contest: contestId })
      .populate("contest", "name title");

    if (!job) {
      return null;
    }

    const contestName = job?.contest?.name || job?.contest?.title;

    return {
      contestId: job.contest._id,
      contestName,
      // Backwards-compatible field name
      contestTitle: contestName,
      status: job.status,
      progress: job.progress,
      currentPhase: this.getPhaseDescription(job.status),
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error: job.error,
      results: job.results,
    };
  }

  /**
   * Get human-readable phase description
   */
  getPhaseDescription(status) {
    const descriptions = {
      pending: "Waiting to start",
      queued: "In queue, starting soon",
      preprocessing: "Processing and normalizing code submissions",
      vectorizing: "Building TF-IDF vectors for comparison",
      comparing: "Computing pairwise similarities",
      clustering: "Identifying cheating groups",
      applying_penalties: "Applying penalties to flagged users",
      completed: "Detection completed",
      failed: "Detection failed",
    };
    return descriptions[status] || status;
  }

  /**
   * Get all active and pending jobs
   */
  async getAllJobs() {
    const jobs = await PlagiarismCheck.find({
      status: { $ne: "completed" },
    })
      .populate("contest", "name title status")
      .sort({ createdAt: -1 });

    return jobs
      .filter((job) => job.contest) // Filter out jobs with deleted contests
      .map((job) => ({
        contestId: job.contest._id,
        contestName: job?.contest?.name || job?.contest?.title,
        // Backwards-compatible field name
        contestTitle: job?.contest?.name || job?.contest?.title,
        status: job.status,
        phase: this.getPhaseDescription(job.status),
        progress: job.progress,
        createdAt: job.createdAt,
        isActive: this.activeJobs.has(job.contest._id.toString()),
      }));
  }

  /**
   * Cancel a pending job
   */
  async cancelJob(contestId) {
    const job = await PlagiarismCheck.findOne({ contest: contestId });

    if (!job) {
      throw new Error("Job not found");
    }

    if (this.activeJobs.has(contestId)) {
      throw new Error("Cannot cancel an active job");
    }

    if (job.status === "completed") {
      throw new Error("Job already completed");
    }

    job.status = "failed";
    job.error = "Cancelled by admin";
    await job.save();

    return job;
  }
}

// Singleton instance
let jobRunnerInstance = null;

export function getJobRunner() {
  if (!jobRunnerInstance) {
    jobRunnerInstance = new PlagiarismJobRunner();
  }
  return jobRunnerInstance;
}

export default PlagiarismJobRunner;
