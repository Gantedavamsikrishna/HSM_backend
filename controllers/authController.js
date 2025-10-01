// authController.js
// Controller for authentication (MongoDB/Mongoose version)
const authService = require("../services/authService");

module.exports = {
  async register(req, res) {
    try {
      const user = await authService.register(req.body);
      res.status(201).json({ message: "User created successfully", user });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async login(req, res) {
    try {
      const result = await authService.login(req.body);
      res.json(result);
    } catch (error) {
      res.status(401).json({ message: error.message });
    }
  },

  async me(req, res) {
    try {
      const user = await authService.getMe(req.user.id);
      res.json({ user });
    } catch (error) {
      res.status(401).json({ message: error.message });
    }
  },

  async updateProfile(req, res) {
    try {
      const result = await authService.updateProfile(req.user, req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const result = await authService.changePassword(
        req.user.id,
        currentPassword,
        newPassword
      );
      res.json(result);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async logout(req, res) {
    // Stateless JWT: just return success
    res.json({ message: "Logout successful" });
  },
};
