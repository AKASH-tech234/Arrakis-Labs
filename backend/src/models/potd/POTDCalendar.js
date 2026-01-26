import mongoose from "mongoose";

const potdCalendarSchema = new mongoose.Schema(
  {
    
    scheduledDate: {
      type: Date,
      required: [true, "Scheduled date is required"],
      unique: true,
      index: true,
    },
    
    problemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: [true, "Problem ID is required"],
    },
    
    scheduledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    
    isPublished: {
      type: Boolean,
      default: false,
    },
    
    publishedAt: {
      type: Date,
      default: null,
    },
    
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

potdCalendarSchema.pre("save", function (next) {
  if (this.isModified("scheduledDate")) {
    const date = new Date(this.scheduledDate);
    date.setUTCHours(0, 0, 0, 0);
    this.scheduledDate = date;
  }
  next();
});

potdCalendarSchema.virtual("isLocked").get(function () {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return this.scheduledDate <= today;
});

potdCalendarSchema.index({ scheduledDate: 1, isPublished: 1 });

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

potdCalendarSchema.statics.getTodaySchedule = async function () {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  return this.findOne({ scheduledDate: today }).populate(
    "problemId",
    "title difficulty tags description constraints examples"
  );
};

export default mongoose.model("POTDCalendar", potdCalendarSchema);
