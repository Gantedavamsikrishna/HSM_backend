// authService.js
// Service for authentication (MongoDB/Mongoose version)
const authRepository = require("../repositories/authRepository");

module.exports = {
  async register(data) {
    return await authRepository.register(data);
  },
  async login(data) {
    return await authRepository.login(data);
  },
  async getMe(id) {
    return await authRepository.getMe(id);
  },

  async updateProfile(user, data) {
    return await authRepository.updateProfile(user, data);
  },

  async changePassword(userId, currentPassword, newPassword) {
    return await authRepository.changePassword(
      userId,
      currentPassword,
      newPassword
    );
  },

  async logout() {
    // Stateless JWT: nothing to do
    return { message: "Logout successful" };
  },
};
