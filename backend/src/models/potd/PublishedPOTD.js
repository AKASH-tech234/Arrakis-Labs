import mongoose from "mongoose";

const publishedPOTDSchema = new mongoose.Schema(
  {
    
    activeDate: {
      type: Date,
      required: [true, "Active date is required"],
      unique: true,
      index: true,
    },
    
    problemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: [true, "Problem ID is required"],
    },
    
    calendarEntry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "POTDCalendar",
    },
    
    startTime: {
      type: Date,
      required: true,
    },
    
    endTime: {
      type: Date,
      required: true,
    },
    
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

publishedPOTDSchema.virtual("isActive").get(function () {
  const now = new Date();
  return now >= this.startTime && now <= this.endTime && this.status === "active";
});

publishedPOTDSchema.index({ activeDate: -1 });
publishedPOTDSchema.index({ status: 1, activeDate: -1 });

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

publishedPOTDSchema.statics.existsForDate = async function (date) {
  const checkDate = new Date(date);
  checkDate.setUTCHours(0, 0, 0, 0);

  const existing = await this.findOne({ activeDate: checkDate });
  return !!existing;
};

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
