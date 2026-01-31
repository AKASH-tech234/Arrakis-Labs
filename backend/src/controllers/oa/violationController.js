import { OASession, OAViolation } from "../../models/oa/index.js";

/**
 * Record a proctoring violation
 * POST /api/oa/sessions/:sessionId/violations
 */
export const recordViolation = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { type, metadata } = req.body;
    const userId = req.user._id;

    // Validate type
    const validTypes = [
      "tab_hidden",
      "tab_blur",
      "fullscreen_exit",
      "window_resize",
      "devtools_open",
    ];

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: "Invalid violation type",
      });
    }

    // Verify session is active
    const session = await OASession.findOne({
      _id: sessionId,
      userId,
      status: "live",
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Session not found or not active",
      });
    }

    // Check if proctoring warnings are enabled (warningsAllowed > 0 means proctoring active)
    if (!session.proctoring?.warningsAllowed || session.proctoring.warningsAllowed <= 0) {
      return res.json({
        success: true,
        data: {
          recorded: false,
          message: "Proctoring not enabled",
        },
      });
    }

    // Get current warning count
    const currentWarnings = session.proctoring.warningCount || 0;
    const warningsAllowed = session.proctoring.warningsAllowed || 3;
    const newWarningNumber = currentWarnings + 1;

    // Create violation record (include userId as required by schema)
    const violation = await OAViolation.create({
      sessionId,
      userId,
      type,
      warningNumber: newWarningNumber,
      meta: {
        ...metadata,
      },
    });

    // Update session warning count
    session.proctoring.warningCount = newWarningNumber;
    session.proctoring.lastViolationAt = new Date();

    // Check if should terminate
    let terminated = false;
    if (newWarningNumber > warningsAllowed) {
      session.status = "terminated";
      session.terminatedReason = "warnings_exceeded";
      session.submittedAt = new Date();
      terminated = true;
    }

    await session.save();

    res.json({
      success: true,
      data: {
        recorded: true,
        warningNumber: newWarningNumber,
        warningsRemaining: Math.max(0, warningsAllowed - newWarningNumber),
        warningsAllowed,
        terminated,
        terminatedReason: terminated ? "warnings_exceeded" : null,
      },
    });
  } catch (error) {
    console.error("Error recording violation:", error);
    res.status(500).json({
      success: false,
      error: "Failed to record violation",
      message: error.message,
    });
  }
};

/**
 * Get violations for a session
 * GET /api/oa/sessions/:sessionId/violations
 */
export const getViolations = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;

    // Verify session ownership
    const session = await OASession.findOne({
      _id: sessionId,
      userId,
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Session not found",
      });
    }

    const violations = await OAViolation.find({ sessionId })
      .sort({ createdAt: 1 })
      .lean();

    res.json({
      success: true,
      data: {
        violations: violations.map((v) => ({
          type: v.type,
          warningNumber: v.warningNumber,
          timestamp: v.createdAt,
        })),
        totalWarnings: violations.length,
        warningsAllowed: session.proctoring?.warningsAllowed || 3,
      },
    });
  } catch (error) {
    console.error("Error getting violations:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get violations",
      message: error.message,
    });
  }
};
