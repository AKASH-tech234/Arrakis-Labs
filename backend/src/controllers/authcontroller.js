import User from "../models/User.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import axios from "axios";

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRY || "7d",
  });
};

// Send Token Response
const sendTokenResponse = (user, statusCode, res, message = "Success") => {
  const token = generateToken(user._id);

  // Cookie options
  const cookieOptions = {
    expires: new Date(
      Date.now() + (process.env.JWT_COOKIE_EXPIRE || 7) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  };

  res.status(statusCode).cookie("token", token, cookieOptions).json({
    success: true,
    message,
    token,
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

// @desc    Register/Signup User
// @route   POST /api/auth/signup
// @access  Public
export const signup = async (req, res) => {
  try {
    const { name, email, password, passwordConfirm } = req.body;

    // Validation
    if (!name || !email || !password || !passwordConfirm) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    // Check if passwords match
    if (password !== passwordConfirm) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    // Create new user
    const user = await User.create({
      name,
      email,
      password,
      isEmailVerified: false,
    });

    // Send token response
    sendTokenResponse(user, 201, res, "User registered successfully");
  } catch (error) {
    console.error(`[Auth Error] Signup: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message || "Error during signup",
    });
  }
};

// @desc    Login User
// @route   POST /api/auth/signin
// @access  Public
export const signin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Find user and select password field
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated",
      });
    }

    // Compare passwords
    const isPasswordMatch = await user.matchPassword(password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Send token response
    sendTokenResponse(user, 200, res, "Logged in successfully");
  } catch (error) {
    console.error(`[Auth Error] Signin: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message || "Error during signin",
    });
  }
};

// @desc    Google OAuth Callback
// @route   POST /api/auth/google
// @access  Public
export const googleAuth = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Google token is required",
      });
    }

    // Verify token with Google
    const response = await axios.get(
      `https://www.googleapis.com/oauth2/v1/userinfo?access_token=${token}`
    );

    const { id, name, email, picture } = response.data;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Could not retrieve email from Google account",
      });
    }

    // Check if user exists with googleId
    let user = await User.findOne({ googleId: id });

    if (user) {
      // User exists, update last login
      user.lastLogin = new Date();
      await user.save();
      return sendTokenResponse(user, 200, res, "Logged in with Google");
    }

    // Check if user exists with email
    user = await User.findOne({ email });

    if (user) {
      // Link Google account to existing user
      user.googleId = id;
      user.profileImage = picture || user.profileImage;
      user.lastLogin = new Date();
      await user.save();
      return sendTokenResponse(user, 200, res, "Google account linked");
    }

    // Create new user
    user = await User.create({
      name: name || email.split("@")[0],
      email,
      googleId: id,
      profileImage: picture,
      password: crypto.randomBytes(32).toString("hex"),
      isEmailVerified: true,
    });

    sendTokenResponse(user, 201, res, "Account created with Google");
  } catch (error) {
    console.error(`[Auth Error] Google Auth: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message || "Error during Google authentication",
    });
  }
};

// @desc    GitHub OAuth Callback
// @route   POST /api/auth/github
// @access  Public
export const githubAuth = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "GitHub token is required",
      });
    }

    // Verify token with GitHub
    const userResponse = await axios.get("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const { id, login, name, avatar_url } = userResponse.data;

    // Get email from GitHub
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

    // Check if user exists with githubId
    let user = await User.findOne({ githubId: id });

    if (user) {
      user.lastLogin = new Date();
      await user.save();
      return sendTokenResponse(user, 200, res, "Logged in with GitHub");
    }

    // Check if user exists with email
    user = await User.findOne({ email: primaryEmail });

    if (user) {
      user.githubId = id;
      user.profileImage = avatar_url || user.profileImage;
      user.lastLogin = new Date();
      await user.save();
      return sendTokenResponse(user, 200, res, "GitHub account linked");
    }

    // Create new user
    user = await User.create({
      name: name || login,
      email: primaryEmail,
      githubId: id,
      profileImage: avatar_url,
      password: crypto.randomBytes(32).toString("hex"),
      isEmailVerified: true,
    });

    sendTokenResponse(user, 201, res, "Account created with GitHub");
  } catch (error) {
    console.error(`[Auth Error] GitHub Auth: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message || "Error during GitHub authentication",
    });
  }
};

// @desc    Logout User
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req, res) => {
  try {
    res.clearCookie("token");

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

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
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

// @desc    Update user profile
// @route   PUT /api/auth/update-profile
// @access  Private
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

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
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

    // Verify current password
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
