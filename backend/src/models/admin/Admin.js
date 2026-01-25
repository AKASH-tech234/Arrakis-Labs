import mongoose from "mongoose";
import bcrypt from "bcrypt";

/**
 * Admin Schema
 * Admins are created via seed script or mongo shell - NEVER via UI
 */
const adminSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false, // Never return password in queries
    },
    role: {
      type: String,
      enum: ["super_admin", "admin"],
      default: "admin",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
adminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(12); // Higher rounds for admin
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
adminSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Static method to find by credentials
adminSchema.statics.findByCredentials = async function (email, password) {
  const admin = await this.findOne({ email, isActive: true }).select("+password");
  if (!admin) return null;

  const isMatch = await admin.matchPassword(password);
  if (!isMatch) return null;

  return admin;
};

export default mongoose.model("Admin", adminSchema);
