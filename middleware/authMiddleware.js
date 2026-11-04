const jwt = require("jsonwebtoken");
const User = require("../models/user");

// Verify logged-in user
const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user || !req.user.isActive) {
      return res.status(401).json({
        success: false,
        message: "User not found or account disabled"
      });
    }

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Invalid or expired token"
    });
  }
};

// Role-based access
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission"
      });
    }

    const normalizedRoles = roles.map((role) => role.toLowerCase());
    if (!normalizedRoles.includes(req.user.role.toLowerCase())) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission"
      });
    }

    next();
  };
};

module.exports = {
  protect,
  authorize,
  // Aliases for compatibility across route files
  authMiddleware: protect,
  authorizeRoles: authorize
};
