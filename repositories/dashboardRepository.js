// dashboardRepository.js
// Repository for dashboard statistics (MongoDB/Mongoose version)
const Patient = require("../models/Patient");
const Appointment = require("../models/Appointment");
const LabTest = require("../models/LabTest");
const Bill = require("../models/Bill");
const User = require("../models/User");
const Doctor = require("../models/Doctor");

module.exports = {
  async getStats(user) {
    const userRole = user.role;
    const stats = {};
    // Common stats for all roles
    stats.totalPatients = await Patient.countDocuments();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    stats.totalAppointments = await Appointment.countDocuments();
    stats.todayAppointments = await Appointment.countDocuments({
      date_time: { $gte: today, $lt: tomorrow },
    });
    stats.todayScheduled = await Appointment.countDocuments({
      status: "scheduled",
      date_time: { $gte: today, $lt: tomorrow },
    });
    stats.todayCompleted = await Appointment.countDocuments({
      status: "completed",
      date_time: { $gte: today, $lt: tomorrow },
    });
    if (userRole === "admin") {
      stats.totalTests = await LabTest.countDocuments();
      stats.pendingTests = await LabTest.countDocuments({ status: "pending" });
      stats.completedTests = await LabTest.countDocuments({
        status: "completed",
      });
      stats.totalBills = await Bill.countDocuments();
      stats.totalRevenue = await Bill.aggregate([
        { $group: { _id: null, total: { $sum: "$total_amount" } } },
      ]).then((r) => r[0]?.total || 0);
      stats.totalCollected = await Bill.aggregate([
        { $group: { _id: null, total: { $sum: "$paid_amount" } } },
      ]).then((r) => r[0]?.total || 0);
      stats.paidBills = await Bill.countDocuments({ status: "paid" });
      stats.pendingBills = await Bill.countDocuments({ status: "pending" });
      stats.totalUsers = await User.countDocuments();
      stats.activeUsers = await User.countDocuments({ is_active: true });
      stats.totalDoctors = await Doctor.countDocuments();
    }
    // Add more role-specific stats as needed
    return stats;
  },
};
