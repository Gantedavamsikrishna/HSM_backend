const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const authController = require("../controllers/authController");

const router = express.Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/me", authenticateToken, authController.me);
router.put("/profile", authenticateToken, authController.updateProfile);
router.put(
  "/change-password",
  authenticateToken,
  authController.changePassword
);
router.post("/logout", authenticateToken, authController.logout);

module.exports = router;
