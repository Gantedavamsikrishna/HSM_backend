const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authenticateToken = async (req, res, next) => {
  console.log("authenticateToken middleware reached");

  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN
  console.log("Token received in middleware:", token);

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("jwt.verify succeeded");
    // Always log the decoded payload for debugging
    console.log("Decoded JWT payload:", JSON.stringify(decoded, null, 2));
    // Use decoded.id (not decoded.userId) based on your JWT payload
    const user = await User.findById(decoded.id).select(
      "id email first_name last_name role is_active phone"
    );
    if (!user || user.is_active === false) {
      return res.status(401).json({ message: "Invalid or inactive user" });
    }
    req.user = user;
    next();
  } catch (error) {
    console.error("authenticateToken CATCH BLOCK error:", error);
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    } else if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid token" });
    } else {
      return res.status(500).json({ message: "Token verification failed" });
    }
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Insufficient permissions",
        required: roles,
        current: req.user.role,
      });
    }

    next();
  };
};

const requireAdmin = requireRole(["admin"]);
const requireDoctor = requireRole(["admin", "doctor"]);
const requireReception = requireRole(["admin", "reception"]);
const requireLab = requireRole(["admin", "lab"]);

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireDoctor,
  requireReception,
  requireLab,
};
