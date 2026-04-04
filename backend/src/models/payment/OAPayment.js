import mongoose from "mongoose";

const oaPaymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    purpose: {
      type: String,
      enum: ["oa_session"],
      default: "oa_session",
      index: true,
    },
    provider: {
      type: String,
      enum: ["razorpay"],
      default: "razorpay",
      index: true,
    },
    currency: {
      type: String,
      default: "INR",
    },
    amountPaise: {
      type: Number,
      required: true,
      min: 1,
    },

    razorpayOrderId: {
      type: String,
      required: true,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
      index: true,
    },
    razorpaySignature: {
      type: String,
      default: null,
      select: false,
    },

    status: {
      type: String,
      enum: ["created", "paid", "failed"],
      default: "created",
      index: true,
    },

    paidAt: {
      type: Date,
      default: null,
      index: true,
    },

    reservedAt: {
      type: Date,
      default: null,
    },
    reservedUntil: {
      type: Date,
      default: null,
      index: true,
    },
    reservedRequestId: {
      type: String,
      default: null,
    },

    usedAt: {
      type: Date,
      default: null,
      index: true,
    },
    usedForSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OASession",
      default: null,
    },

    receipt: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

oaPaymentSchema.index({ userId: 1, purpose: 1, status: 1, usedAt: 1 });
oaPaymentSchema.index({ userId: 1, purpose: 1, status: 1, reservedUntil: 1 });

const OAPayment = mongoose.model("OAPayment", oaPaymentSchema);

export default OAPayment;
