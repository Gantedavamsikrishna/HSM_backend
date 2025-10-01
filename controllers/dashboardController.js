// dashboardController.js
// Controller for dashboard statistics (MongoDB/Mongoose version)
const dashboardService = require("../services/dashboardService");

module.exports = {
  async getStats(req, res) {
    try {
      const stats = await dashboardService.getStats(req.user);
      res.json(stats);
    } catch (error) {
      res
        .status(500)
        .json({
          message: "Failed to fetch dashboard stats",
          error: error.message,
        });
    }
  },
};
