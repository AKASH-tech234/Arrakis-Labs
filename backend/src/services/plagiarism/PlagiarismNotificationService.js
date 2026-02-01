/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PLAGIARISM NOTIFICATION SERVICE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Handles user notifications for plagiarism detection:
 * - Email notifications when flagged
 * - In-app notifications
 * - Appeal instructions
 */

import User from "../../models/auth/User.js";
import { CheatingGroup, PlagiarismResult } from "../../models/plagiarism/index.js";
import Contest from "../../models/contest/Contest.js";

class PlagiarismNotificationService {
  constructor(options = {}) {
    this.options = {
      enableEmail: process.env.ENABLE_PLAGIARISM_EMAILS === "true",
      appealDeadlineDays: 7,
      ...options,
    };
  }

  /**
   * Notify users in a cheating group
   */
  async notifyCheatingGroup(groupId) {
    const group = await CheatingGroup.findById(groupId)
      .populate("members.user", "name email notificationPreferences")
      .populate("contest", "title");

    if (!group) {
      throw new Error("Group not found");
    }

    const notifications = [];

    for (const member of group.members) {
      if (!member.user) continue;

      const notification = await this.createPlagiarismNotification({
        userId: member.user._id,
        userEmail: member.user.email,
        userName: member.user.name,
        contestTitle: group.contest.title,
        contestId: group.contest._id,
        groupId: group.groupId,
        severity: group.severity,
        avgSimilarity: member.avgSimilarity,
        affectedProblems: member.affectedProblems,
      });

      notifications.push(notification);
    }

    // Mark group as notified
    group.notifiedAt = new Date();
    await group.save();

    return notifications;
  }

  /**
   * Create a plagiarism notification for a user
   */
  async createPlagiarismNotification(data) {
    const notification = {
      type: "plagiarism_detected",
      userId: data.userId,
      contestId: data.contestId,
      createdAt: new Date(),
      read: false,
      data: {
        contestTitle: data.contestTitle,
        groupId: data.groupId,
        severity: data.severity,
        similarityScore: data.avgSimilarity,
        message: this.generateNotificationMessage(data),
        appealDeadline: this.calculateAppealDeadline(),
      },
    };

    // Store notification (you would add this to your Notification model)
    // await Notification.create(notification);

    // Send email if enabled
    if (this.options.enableEmail && data.userEmail) {
      await this.sendPlagiarismEmail(data);
    }

    return notification;
  }

  /**
   * Generate notification message based on severity
   */
  generateNotificationMessage(data) {
    const severityMessages = {
      critical: `Your submission in "${data.contestTitle}" has been flagged for high similarity (${(data.avgSimilarity * 100).toFixed(1)}%) with other submissions. This has resulted in disqualification from the contest.`,
      high: `Your submission in "${data.contestTitle}" has been flagged for significant similarity (${(data.avgSimilarity * 100).toFixed(1)}%) with other submissions. Your result has been placed under review.`,
      medium: `Your submission in "${data.contestTitle}" shows moderate similarity (${(data.avgSimilarity * 100).toFixed(1)}%) with other submissions and is under review.`,
      low: `Your submission in "${data.contestTitle}" shows some similarity (${(data.avgSimilarity * 100).toFixed(1)}%) with other submissions. No action has been taken at this time.`,
    };

    return severityMessages[data.severity] || severityMessages.medium;
  }

  /**
   * Calculate appeal deadline
   */
  calculateAppealDeadline() {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + this.options.appealDeadlineDays);
    return deadline;
  }

  /**
   * Send plagiarism notification email
   */
  async sendPlagiarismEmail(data) {
    // This would integrate with your email service (SendGrid, Mailgun, etc.)
    const emailContent = {
      to: data.userEmail,
      subject: `Plagiarism Detection Notice - ${data.contestTitle}`,
      html: this.generateEmailTemplate(data),
    };

    console.log(`[PlagiarismNotification] Email queued for ${data.userEmail}`);

    // Integrate with your email service here:
    // await emailService.send(emailContent);

    return emailContent;
  }

  /**
   * Generate email HTML template
   */
  generateEmailTemplate(data) {
    const appealDeadline = this.calculateAppealDeadline().toLocaleDateString();

    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .warning-box { background: #fef2f2; border: 1px solid #dc2626; padding: 15px; margin: 15px 0; border-radius: 5px; }
    .info-box { background: #eff6ff; border: 1px solid #3b82f6; padding: 15px; margin: 15px 0; border-radius: 5px; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    .button { display: inline-block; padding: 10px 20px; background: #3b82f6; color: white; text-decoration: none; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Plagiarism Detection Notice</h1>
    </div>
    <div class="content">
      <p>Dear ${data.userName},</p>
      
      <div class="warning-box">
        <strong>Contest:</strong> ${data.contestTitle}<br>
        <strong>Severity:</strong> ${data.severity.toUpperCase()}<br>
        <strong>Similarity Score:</strong> ${(data.avgSimilarity * 100).toFixed(1)}%
      </div>
      
      <p>${this.generateNotificationMessage(data)}</p>
      
      <div class="info-box">
        <strong>What This Means:</strong>
        <ul>
          <li>Your submission showed significant similarity with one or more other participants</li>
          <li>This could be due to copying, collaboration, or use of common templates</li>
          <li>Your contest result may be affected based on our academic integrity policy</li>
        </ul>
      </div>
      
      <h3>Appeal Process</h3>
      <p>If you believe this detection is incorrect, you may submit an appeal:</p>
      <ul>
        <li><strong>Appeal Deadline:</strong> ${appealDeadline}</li>
        <li>Provide evidence that your solution was independently developed</li>
        <li>Include any relevant context (common algorithms, provided templates, etc.)</li>
      </ul>
      
      <p style="text-align: center; margin-top: 20px;">
        <a href="${process.env.FRONTEND_URL}/appeals/new?group=${data.groupId}" class="button">
          Submit Appeal
        </a>
      </p>
    </div>
    <div class="footer">
      <p>This is an automated message from the Arrakis Contest Platform.</p>
      <p>If you have questions, please contact support.</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Notify all users for a completed plagiarism check
   */
  async notifyAllFlaggedUsers(contestId) {
    const groups = await CheatingGroup.find({
      contest: contestId,
      status: { $in: ["pending", "penalties_applied"] },
      notifiedAt: { $exists: false },
    });

    const results = [];
    for (const group of groups) {
      try {
        const notifications = await this.notifyCheatingGroup(group._id);
        results.push({
          groupId: group.groupId,
          notificationsSent: notifications.length,
        });
      } catch (error) {
        console.error(`Failed to notify group ${group.groupId}:`, error);
        results.push({
          groupId: group.groupId,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Get notification summary for a user
   */
  async getUserNotificationSummary(userId) {
    const groups = await CheatingGroup.find({
      "members.user": userId,
    })
      .populate("contest", "title")
      .sort({ detectedAt: -1 });

    return {
      totalIncidents: groups.length,
      pendingAppeals: groups.filter((g) => g.status === "pending").length,
      resolved: groups.filter((g) => ["resolved", "dismissed"].includes(g.status)).length,
      recent: groups.slice(0, 5).map((g) => ({
        contestTitle: g.contest?.title,
        severity: g.severity,
        status: g.status,
        detectedAt: g.detectedAt,
      })),
    };
  }
}

export default new PlagiarismNotificationService();
export { PlagiarismNotificationService };
