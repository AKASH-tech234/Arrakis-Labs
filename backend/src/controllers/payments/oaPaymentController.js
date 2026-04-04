import crypto from "crypto";
import Razorpay from "razorpay";
import { OAPayment } from "../../models/payment/index.js";

const OA_SESSION_PRICE_PAISE = 1000; // ₹10
const PAYMENT_RESERVATION_MS = 5 * 60 * 1000;

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    const err = new Error("Razorpay keys are not configured");
    err.status = 500;
    throw err;
  }

  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

function isOAPaymentRequired() {
  return process.env.OA_PAYMENT_REQUIRED !== "false";
}

export async function createOAOrder(req, res) {
  if (!isOAPaymentRequired()) {
    return res.status(200).json({
      success: true,
      data: {
        paymentRequired: false,
      },
    });
  }

  const userId = req.user?._id;
  const userName = req.user?.name;
  const userEmail = req.user?.email;

  const existingCredit = await OAPayment.findOne({
    userId,
    purpose: "oa_session",
    status: "paid",
    usedAt: null,
  }).lean();

  if (existingCredit) {
    return res.status(200).json({
      success: true,
      data: {
        paymentRequired: false,
      },
    });
  }

  const razorpay = getRazorpayClient();

  const receipt = `oa_${userId}_${Date.now()}`;

  const order = await razorpay.orders.create({
    amount: OA_SESSION_PRICE_PAISE,
    currency: "INR",
    receipt,
    notes: {
      purpose: "oa_session",
      userId: String(userId),
    },
  });

  await OAPayment.create({
    userId,
    purpose: "oa_session",
    provider: "razorpay",
    currency: "INR",
    amountPaise: OA_SESSION_PRICE_PAISE,
    razorpayOrderId: order.id,
    status: "created",
    receipt,
  });

  return res.status(201).json({
    success: true,
    data: {
      paymentRequired: true,
      provider: "razorpay",
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amountPaise: OA_SESSION_PRICE_PAISE,
      currency: "INR",
      name: "Arrakis Labs",
      description: "OA session access",
      prefill: {
        name: userName || "",
        email: userEmail || "",
      },
    },
  });
}

export async function verifyOAPayment(req, res) {
  if (!isOAPaymentRequired()) {
    return res.status(200).json({
      success: true,
      data: { paymentRequired: false },
    });
  }

  const userId = req.user?._id;

  const orderId = req.body?.orderId || req.body?.razorpay_order_id;
  const paymentId = req.body?.paymentId || req.body?.razorpay_payment_id;
  const signature = req.body?.signature || req.body?.razorpay_signature;

  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({
      success: false,
      error: "Missing payment verification fields",
      code: "INVALID_REQUEST",
    });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return res.status(500).json({
      success: false,
      error: "Razorpay keys are not configured",
      code: "SERVER_MISCONFIGURED",
    });
  }

  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  if (expected !== signature) {
    return res.status(401).json({
      success: false,
      error: "Payment signature verification failed",
      code: "SIGNATURE_MISMATCH",
    });
  }

  const payment = await OAPayment.findOne({
    userId,
    razorpayOrderId: orderId,
  });

  if (!payment) {
    return res.status(404).json({
      success: false,
      error: "Order not found",
      code: "ORDER_NOT_FOUND",
    });
  }

  if (payment.status === "paid") {
    return res.status(200).json({
      success: true,
      data: { status: "paid" },
    });
  }

  payment.razorpayPaymentId = paymentId;
  payment.razorpaySignature = signature;
  payment.status = "paid";
  payment.paidAt = new Date();

  await payment.save();

  return res.status(200).json({
    success: true,
    data: {
      status: "paid",
      reservationWindowMs: PAYMENT_RESERVATION_MS,
    },
  });
}
