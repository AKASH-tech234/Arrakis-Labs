import { OASession, OAViolation } from "../../models/oa/index.js";

export const recordViolation = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { type, metadata } = req.body;
    const userId = req.user._id;

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

    if (!session.proctoring?.warningsAllowed || session.proctoring.warningsAllowed <= 0) {
      return res.json({
        success: true,
        data: {
          recorded: false,
          message: "Proctoring not enabled",
        },
      });
    }

    const currentWarnings = session.proctoring.warningCount || 0;
    const warningsAllowed = session.proctoring.warningsAllowed || 3;
    const newWarningNumber = currentWarnings + 1;

    const violation = await OAViolation.create({
      sessionId,
      userId,
      type,
      warningNumber: newWarningNumber,
      meta: {
        ...metadata,
      },
    });

    session.proctoring.warningCount = newWarningNumber;
    session.proctoring.lastViolationAt = new Date();

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

export const getViolations = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;

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
