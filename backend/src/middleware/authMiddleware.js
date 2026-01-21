import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Protect routes - verify JWT
export const protect = async (req, res, next) => {
  try {
    let token;

    // Get token from header or cookie (userToken for users)
    if (req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies.userToken) {
      token = req.cookies.userToken;
    } else if (req.cookies.token) {
      // Fallback for legacy cookie name
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired",
      });
    }

    res.status(401).json({
      success: false,
      message: "Not authorized to access this route",
    });
  }
};

// Authorize specific roles
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`,
      });
    }
    next();
  };
};

// Optional auth - populates req.user if token exists, but doesn't require it
export const optionalAuth = async (req, res, next) => {
  try {
    let token;

    // Get token from header or cookie (userToken for users)
    if (req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies.userToken) {
      token = req.cookies.userToken;
    } else if (req.cookies.token) {
      // Fallback for legacy cookie name
      token = req.cookies.token;
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id);
    }

    next();
  } catch (error) {
    // Token invalid - continue without user
    next();
  }
};
