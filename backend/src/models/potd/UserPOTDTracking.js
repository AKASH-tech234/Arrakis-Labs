import mongoose from "mongoose";

const userPOTDTrackingSchema = new mongoose.Schema(
  {
    
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    
    potdId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PublishedPOTD",
      required: [true, "POTD ID is required"],
    },
    
    problemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: [true, "Problem ID is required"],
    },
    
    potdDate: {
      type: Date,
      required: true,
      index: true,
    },
    
    solved: {
      type: Boolean,
      default: false,
    },
    
    solvedAt: {
      type: Date,
      default: null,
    },
    
    attempts: {
      type: Number,
      default: 0,
    },
    
    timeSpent: {
      type: Number,
      default: 0,
    },
    
    firstAttemptAt: {
      type: Date,
      default: null,
    },
    
    lastAttemptAt: {
      type: Date,
      default: null,
    },
    
    bestSubmissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Submission",
      default: null,
    },
    
    language: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userPOTDTrackingSchema.index({ userId: 1, potdDate: -1 });
userPOTDTrackingSchema.index({ userId: 1, potdId: 1 }, { unique: true });
userPOTDTrackingSchema.index({ userId: 1, solved: 1, potdDate: -1 });

userPOTDTrackingSchema.statics.getUserCalendar = async function (
  userId,
  startDate,
  endDate
) {
  const start = new Date(startDate);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setUTCHours(23, 59, 59, 999);

  return this.find({
    userId,
    potdDate: { $gte: start, $lte: end },
  })
    .populate("problemId", "title difficulty")
    .sort({ potdDate: -1 });
};

userPOTDTrackingSchema.statics.hasSolvedToday = async function (userId) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const tracking = await this.findOne({
    userId,
    potdDate: today,
    solved: true,
  });

  return !!tracking;
};

userPOTDTrackingSchema.statics.getOrCreate = async function (
  userId,
  potdId,
  problemId,
  potdDate
) {
  let tracking = await this.findOne({ userId, potdId });

  if (!tracking) {
    tracking = await this.create({
      userId,
      potdId,
      problemId,
      potdDate,
    });
  }

  return tracking;
};

export default mongoose.model("UserPOTDTracking", userPOTDTrackingSchema);
