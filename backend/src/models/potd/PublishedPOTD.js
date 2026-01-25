import mongoose from "mongoose";

/**
 * Published POTD Schema
 * Records the actual published problem of the day
 * Created by the cron job when a POTD goes live
 */
const publishedPOTDSchema = new mongoose.Schema(
  {
    // The date this POTD is active for (UTC midnight)
    activeDate: {
      type: Date,
      required: [true, "Active date is required"],
      unique: true,
      index: true,
    },
    // Reference to the problem
    problemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: [true, "Problem ID is required"],
    },
    // Reference to the calendar entry that scheduled it
    calendarEntry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "POTDCalendar",
    },
    // Start time (00:00:00 UTC)
    startTime: {
      type: Date,
      required: true,
    },
    // End time (23:59:59 UTC)
    endTime: {
      type: Date,
      required: true,
    },
    // Statistics for this POTD
    stats: {
      totalAttempts: {
        type: Number,
        default: 0,
      },
      totalSolved: {
        type: Number,
        default: 0,
      },
      uniqueUsers: {
        type: Number,
        default: 0,
      },
    },
    // Status of the POTD
    status: {
      type: String,
      enum: ["active", "completed", "cancelled"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

// Ensure dates are stored at UTC midnight
publishedPOTDSchema.pre("save", function (next) {
  if (this.isNew) {
    const date = new Date(this.activeDate);
    date.setUTCHours(0, 0, 0, 0);
    this.activeDate = date;
    this.startTime = new Date(date);

    const endDate = new Date(date);
    endDate.setUTCHours(23, 59, 59, 999);
    this.endTime = endDate;
  }
  next();
});

// Virtual to check if POTD is currently active
publishedPOTDSchema.virtual("isActive").get(function () {
  const now = new Date();
  return now >= this.startTime && now <= this.endTime && this.status === "active";
});

// Index for efficient queries
publishedPOTDSchema.index({ activeDate: -1 });
publishedPOTDSchema.index({ status: 1, activeDate: -1 });

// Static method to get today's published POTD
publishedPOTDSchema.statics.getToday = async function () {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  return this.findOne({
    activeDate: today,
    status: "active",
  }).populate(
    "problemId",
    "title difficulty tags description constraints examples totalSubmissions acceptedSubmissions"
  );
};

// Static method to check if POTD exists for a date
publishedPOTDSchema.statics.existsForDate = async function (date) {
  const checkDate = new Date(date);
  checkDate.setUTCHours(0, 0, 0, 0);

  const existing = await this.findOne({ activeDate: checkDate });
  return !!existing;
};

// Static method to get recent POTDs
publishedPOTDSchema.statics.getRecent = async function (limit = 7) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  return this.find({
    activeDate: { $lte: today },
  })
    .populate("problemId", "title difficulty tags")
    .sort({ activeDate: -1 })
    .limit(limit);
};

export default mongoose.model("PublishedPOTD", publishedPOTDSchema);
