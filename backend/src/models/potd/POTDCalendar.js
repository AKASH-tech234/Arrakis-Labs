import mongoose from "mongoose";

/**
 * POTD Calendar Schema
 * Stores scheduled problems for specific dates (Admin scheduling)
 * Each date can have only ONE scheduled problem
 */
const potdCalendarSchema = new mongoose.Schema(
  {
    // The date for which this POTD is scheduled (stored as UTC midnight)
    scheduledDate: {
      type: Date,
      required: [true, "Scheduled date is required"],
      unique: true,
      index: true,
    },
    // Reference to the problem
    problemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: [true, "Problem ID is required"],
    },
    // Admin who scheduled this POTD
    scheduledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    // Once published, the schedule is locked
    isPublished: {
      type: Boolean,
      default: false,
    },
    // Timestamp when it was published (by cron job)
    publishedAt: {
      type: Date,
      default: null,
    },
    // Notes/reason for selection (optional)
    notes: {
      type: String,
      maxlength: 500,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Ensure we store dates at UTC midnight for consistency
potdCalendarSchema.pre("save", function (next) {
  if (this.isModified("scheduledDate")) {
    const date = new Date(this.scheduledDate);
    date.setUTCHours(0, 0, 0, 0);
    this.scheduledDate = date;
  }
  next();
});

// Virtual to check if the date is in the past (locked)
potdCalendarSchema.virtual("isLocked").get(function () {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return this.scheduledDate <= today;
});

// Index for efficient queries
potdCalendarSchema.index({ scheduledDate: 1, isPublished: 1 });

// Static method to get schedule for a date range
potdCalendarSchema.statics.getScheduleRange = async function (startDate, endDate) {
  const start = new Date(startDate);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setUTCHours(23, 59, 59, 999);

  return this.find({
    scheduledDate: { $gte: start, $lte: end },
  })
    .populate("problemId", "title difficulty tags")
    .populate("scheduledBy", "name email")
    .sort({ scheduledDate: 1 });
};

// Static method to get today's scheduled POTD
potdCalendarSchema.statics.getTodaySchedule = async function () {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  return this.findOne({ scheduledDate: today }).populate(
    "problemId",
    "title difficulty tags description constraints examples"
  );
};

export default mongoose.model("POTDCalendar", potdCalendarSchema);
