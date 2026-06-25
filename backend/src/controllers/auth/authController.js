import User from "../../models/auth/User.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import axios from "axios";
import { OAuth2Client } from "google-auth-library";

// ─── Token Helpers ───────────────────────────────────────────────────────────

const generateAccessToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRY || "15m",
  });
};

const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d",
  });
};

const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

// ─── Cookie Options ──────────────────────────────────────────────────────────

const getAccessCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    expires: new Date(
      Date.now() + (process.env.JWT_COOKIE_EXPIRE || 1) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    path: "/",
  };
};

const getRefreshCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    expires: new Date(
      Date.now() +
        (process.env.REFRESH_TOKEN_COOKIE_EXPIRE || 7) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    path: "/",
  };
};

// ─── Send Dual Token Response ────────────────────────────────────────────────

const sendTokenResponse = async (user, statusCode, res, message = "Success") => {
  const accessToken = generateAccessToken(user._id);
  const refreshTokenValue = generateRefreshToken(user._id);

  // Store hashed refresh token in DB (token rotation)
  user.refreshToken = hashToken(refreshTokenValue);
  await user.save({ validateBeforeSave: false });

  res
    .status(statusCode)
    .cookie("userToken", accessToken, getAccessCookieOptions())
    .cookie("userRefreshToken", refreshTokenValue, getRefreshCookieOptions())
    .json({
      success: true,
      message,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage,
        stats: user.stats,
      },
    });
};

// ─── Signup ──────────────────────────────────────────────────────────────────

export const signup = async (req, res) => {
  try {
    const { name, email, password, passwordConfirm } = req.body;

    if (!name || !email || !password || !passwordConfirm) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    if (password !== passwordConfirm) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    const user = await User.create({
      name,
      email,
      password,
      isEmailVerified: false,
    });

    await sendTokenResponse(user, 201, res, "User registered successfully");
  } catch (error) {
    console.error(`[Auth Error] Signup: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message || "Error during signup",
    });
  }
};

// ─── Signin ──────────────────────────────────────────────────────────────────

export const signin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated",
      });
    }

    const isPasswordMatch = await user.matchPassword(password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    user.lastLogin = new Date();
    await user.save();

    await sendTokenResponse(user, 200, res, "Logged in successfully");
  } catch (error) {
    console.error(`[Auth Error] Signin: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message || "Error during signin",
    });
  }
};

// ─── Refresh Token (Token Rotation) ─────────────────────────────────────────

export const refreshToken = async (req, res) => {
  try {
    const incomingRefreshToken = req.cookies.userRefreshToken;

    if (!incomingRefreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token not found",
      });
    }

    // Verify the refresh token
    let decoded;
    try {
      decoded = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token",
      });
    }

    // Find user and include the refreshToken field
    const user = await User.findById(decoded.id).select("+refreshToken");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      // Clear cookies for deactivated user
      res.clearCookie("userToken", getAccessCookieOptions());
      res.clearCookie("userRefreshToken", getRefreshCookieOptions());
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated",
      });
    }

    // Verify stored hash matches incoming token (token rotation check)
    const hashedIncoming = hashToken(incomingRefreshToken);
    if (user.refreshToken !== hashedIncoming) {
      // Possible token reuse attack — invalidate all tokens
      user.refreshToken = null;
      await user.save({ validateBeforeSave: false });

      res.clearCookie("userToken", getAccessCookieOptions());
      res.clearCookie("userRefreshToken", getRefreshCookieOptions());

      return res.status(401).json({
        success: false,
        message: "Refresh token has been revoked. Please login again.",
      });
    }

    // Issue new access token + new refresh token (rotation)
    const newAccessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    // Store the new hashed refresh token
    user.refreshToken = hashToken(newRefreshToken);
    await user.save({ validateBeforeSave: false });

    res
      .status(200)
      .cookie("userToken", newAccessToken, getAccessCookieOptions())
      .cookie("userRefreshToken", newRefreshToken, getRefreshCookieOptions())
      .json({
        success: true,
        message: "Token refreshed successfully",
      });
  } catch (error) {
    console.error(`[Auth Error] RefreshToken: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Error refreshing token",
    });
  }
};

// ─── Google Auth ─────────────────────────────────────────────────────────────

export const googleAuth = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Google token is required",
      });
    }

    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (error) {
      console.error(`[Auth Error] Google Token Verification Failed: ${error.message}`);
      return res.status(401).json({
        success: false,
        message: "Invalid or expired Google token",
      });
    }

    const { sub: id, name, email, picture } = payload;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Could not retrieve email from Google account",
      });
    }

    let user = await User.findOne({ googleId: id });

    if (user) {
      user.lastLogin = new Date();
      await user.save();
      return await sendTokenResponse(user, 200, res, "Logged in with Google");
    }

    user = await User.findOne({ email });

    if (user) {
      user.googleId = id;
      user.profileImage = picture || user.profileImage;
      user.lastLogin = new Date();
      await user.save();
      return await sendTokenResponse(user, 200, res, "Google account linked");
    }

    user = await User.create({
      name: name || email.split("@")[0],
      email,
      googleId: id,
      profileImage: picture,
      password: crypto.randomBytes(32).toString("hex"),
      isEmailVerified: true,
    });

    await sendTokenResponse(user, 201, res, "Account created with Google");
  } catch (error) {
    console.error(`[Auth Error] Google Auth: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message || "Error during Google authentication",
    });
  }
};

// ─── GitHub Auth ─────────────────────────────────────────────────────────────

export const githubAuth = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "GitHub token is required",
      });
    }

    const userResponse = await axios.get("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const { id, login, name, avatar_url } = userResponse.data;

    const emailResponse = await axios.get("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const primaryEmail = emailResponse.data.find((e) => e.primary)?.email;

    if (!primaryEmail) {
      return res.status(400).json({
        success: false,
        message: "Could not retrieve email from GitHub account",
      });
    }

    let user = await User.findOne({ githubId: id });

    if (user) {
      user.lastLogin = new Date();
      await user.save();
      return await sendTokenResponse(user, 200, res, "Logged in with GitHub");
    }

    user = await User.findOne({ email: primaryEmail });

    if (user) {
      user.githubId = id;
      user.profileImage = avatar_url || user.profileImage;
      user.lastLogin = new Date();
      await user.save();
      return await sendTokenResponse(user, 200, res, "GitHub account linked");
    }

    user = await User.create({
      name: name || login,
      email: primaryEmail,
      githubId: id,
      profileImage: avatar_url,
      password: crypto.randomBytes(32).toString("hex"),
      isEmailVerified: true,
    });

    await sendTokenResponse(user, 201, res, "Account created with GitHub");
  } catch (error) {
    console.error(`[Auth Error] GitHub Auth: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message || "Error during GitHub authentication",
    });
  }
};

// ─── Logout ──────────────────────────────────────────────────────────────────

export const logout = async (req, res) => {
  try {
    // Clear refresh token from DB
    if (req.user) {
      await User.findByIdAndUpdate(req.user._id, { refreshToken: null });
    }

    // Clear both cookies
    res.clearCookie("userToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      path: "/",
    });

    res.clearCookie("userRefreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      path: "/",
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error(`[Auth Error] Logout: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message || "Error during logout",
    });
  }
};

// ─── Get Me ──────────────────────────────────────────────────────────────────

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user?.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage,
        stats: user.stats,
        preferences: user.preferences,
      },
    });
  } catch (error) {
    console.error(`[Auth Error] GetMe: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message || "Error retrieving user",
    });
  }
};

// ─── Update Profile ──────────────────────────────────────────────────────────

export const updateProfile = async (req, res) => {
  try {
    const { name, profileImage, preferences } = req.body;

    const user = await User.findById(req.user?.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (name) user.name = name;
    if (profileImage) user.profileImage = profileImage;
    if (preferences) {
      user.preferences = { ...user.preferences, ...preferences };
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        preferences: user.preferences,
      },
    });
  } catch (error) {
    console.error(`[Auth Error] UpdateProfile: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message || "Error updating profile",
    });
  }
};

// ─── Change Password ─────────────────────────────────────────────────────────

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, passwordConfirm } = req.body;

    if (!currentPassword || !newPassword || !passwordConfirm) {
      return res.status(400).json({
        success: false,
        message: "Please provide all password fields",
      });
    }

    if (newPassword !== passwordConfirm) {
      return res.status(400).json({
        success: false,
        message: "New passwords do not match",
      });
    }

    const user = await User.findById(req.user?.id).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isMatch = await user.matchPassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error(`[Auth Error] ChangePassword: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message || "Error changing password",
    });
  }
};
