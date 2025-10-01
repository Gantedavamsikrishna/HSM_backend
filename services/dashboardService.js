// dashboardService.js
// Service for dashboard statistics (MongoDB/Mongoose version)
const dashboardRepository = require("../repositories/dashboardRepository");

module.exports = {
  async getStats(user) {
    return await dashboardRepository.getStats(user);
  },
};
