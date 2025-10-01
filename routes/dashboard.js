const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const dashboardController = require("../controllers/dashboardController");

const router = express.Router();

// Get dashboard statistics

router.get("/stats", authenticateToken, dashboardController.getStats);

module.exports = router;

// Get recent activities
router.get("/recent-activities", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const limit = parseInt(req.query.limit) || 10;

    let activities = [];

    if (userRole === "admin") {
      // Admin sees all recent activities
      const [recentPatients] = await pool.execute(
        `
        SELECT 'patient' as type, first_name, last_name, created_at
        FROM patients 
        ORDER BY created_at DESC 
        LIMIT ?
      `,
        [Math.ceil(limit / 4)]
      );

      const [recentAppointments] = await pool.execute(
        `
        SELECT 'appointment' as type, 
               CONCAT(p.first_name, ' ', p.last_name) as patient_name,
               CONCAT(u.first_name, ' ', u.last_name) as doctor_name,
               date_time as created_at
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        JOIN doctors d ON a.doctor_id = d.id
        JOIN users u ON d.user_id = u.id
        ORDER BY a.created_at DESC 
        LIMIT ?
      `,
        [Math.ceil(limit / 4)]
      );

      const [recentBills] = await pool.execute(
        `
        SELECT 'bill' as type,
               CONCAT(p.first_name, ' ', p.last_name) as patient_name,
               total_amount,
               status,
               created_at
        FROM bills b
        JOIN patients p ON b.patient_id = p.id
        ORDER BY b.created_at DESC 
        LIMIT ?
      `,
        [Math.ceil(limit / 4)]
      );

      const [recentLabTests] = await pool.execute(
        `
        SELECT 'lab_test' as type,
               CONCAT(p.first_name, ' ', p.last_name) as patient_name,
               test_name,
               status,
               created_at
        FROM lab_tests lt
        JOIN patients p ON lt.patient_id = p.id
        ORDER BY lt.created_at DESC 
        LIMIT ?
      `,
        [Math.ceil(limit / 4)]
      );

      activities = [
        ...recentPatients.map((a) => ({
          ...a,
          activity: `New patient registered: ${a.first_name} ${a.last_name}`,
        })),
        ...recentAppointments.map((a) => ({
          ...a,
          activity: `Appointment scheduled: ${a.patient_name} with Dr. ${a.doctor_name}`,
        })),
        ...recentBills.map((a) => ({
          ...a,
          activity: `Bill created: ${a.patient_name} - $${a.total_amount}`,
        })),
        ...recentLabTests.map((a) => ({
          ...a,
          activity: `Lab test: ${a.test_name} for ${a.patient_name}`,
        })),
      ];
    } else if (userRole === "doctor") {
      // Doctor sees their related activities
      const [doctorRecord] = await pool.execute(
        "SELECT id FROM doctors WHERE user_id = ?",
        [userId]
      );

      if (doctorRecord.length > 0) {
        const doctorId = doctorRecord[0].id;

        const [doctorAppointments] = await pool.execute(
          `
          SELECT 'appointment' as type,
                 CONCAT(p.first_name, ' ', p.last_name) as patient_name,
                 date_time as created_at,
                 status
          FROM appointments a
          JOIN patients p ON a.patient_id = p.id
          WHERE a.doctor_id = ?
          ORDER BY a.created_at DESC 
          LIMIT ?
        `,
          [doctorId, Math.ceil(limit / 2)]
        );

        const [doctorTreatments] = await pool.execute(
          `
          SELECT 'treatment' as type,
                 CONCAT(p.first_name, ' ', p.last_name) as patient_name,
                 diagnosis,
                 created_at
          FROM treatments t
          JOIN patients p ON t.patient_id = p.id
          WHERE t.doctor_id = ?
          ORDER BY t.created_at DESC 
          LIMIT ?
        `,
          [doctorId, Math.ceil(limit / 2)]
        );

        activities = [
          ...doctorAppointments.map((a) => ({
            ...a,
            activity: `Appointment: ${a.patient_name} - ${a.status}`,
          })),
          ...doctorTreatments.map((a) => ({
            ...a,
            activity: `Treatment: ${a.patient_name} - ${a.diagnosis}`,
          })),
        ];
      }
    } else if (userRole === "reception") {
      // Reception sees patient and billing activities
      const [receptionPatients] = await pool.execute(
        `
        SELECT 'patient' as type, first_name, last_name, created_at
        FROM patients 
        ORDER BY created_at DESC 
        LIMIT ?
      `,
        [Math.ceil(limit / 2)]
      );

      const [receptionBills] = await pool.execute(
        `
        SELECT 'bill' as type,
               CONCAT(p.first_name, ' ', p.last_name) as patient_name,
               total_amount,
               status,
               created_at
        FROM bills b
        JOIN patients p ON b.patient_id = p.id
        ORDER BY b.created_at DESC 
        LIMIT ?
      `,
        [Math.ceil(limit / 2)]
      );

      activities = [
        ...receptionPatients.map((a) => ({
          ...a,
          activity: `New patient: ${a.first_name} ${a.last_name}`,
        })),
        ...receptionBills.map((a) => ({
          ...a,
          activity: `Bill: ${a.patient_name} - $${a.total_amount} (${a.status})`,
        })),
      ];
    } else if (userRole === "lab") {
      // Lab sees lab test activities
      const [labActivities] = await pool.execute(
        `
        SELECT 'lab_test' as type,
               CONCAT(p.first_name, ' ', p.last_name) as patient_name,
               test_name,
               status,
               created_at
        FROM lab_tests lt
        JOIN patients p ON lt.patient_id = p.id
        ORDER BY lt.created_at DESC 
        LIMIT ?
      `,
        [limit]
      );

      activities = labActivities.map((a) => ({
        ...a,
        activity: `${a.test_name} for ${a.patient_name} - ${a.status}`,
      }));
    }

    // Sort all activities by date and limit
    activities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    activities = activities.slice(0, limit);

    res.json({ activities });
  } catch (error) {
    console.error("Get recent activities error:", error);
    res.status(500).json({ message: "Failed to fetch recent activities" });
  }
});

// Get today's schedule (for doctors and reception)
router.get("/today-schedule", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let schedule = [];

    if (userRole === "doctor") {
      const [doctorRecord] = await pool.execute(
        "SELECT id FROM doctors WHERE user_id = ?",
        [userId]
      );

      if (doctorRecord.length > 0) {
        const doctorId = doctorRecord[0].id;

        const [appointments] = await pool.execute(
          `
          SELECT a.id, a.date_time, a.status, a.reason, a.notes,
                 CONCAT(p.first_name, ' ', p.last_name) as patient_name,
                 p.email as patient_email, p.phone as patient_phone
          FROM appointments a
          JOIN patients p ON a.patient_id = p.id
          WHERE a.doctor_id = ? AND DATE(a.date_time) = CURDATE()
          ORDER BY a.date_time ASC
        `,
          [doctorId]
        );

        schedule = appointments;
      }
    } else if (userRole === "reception" || userRole === "admin") {
      const [appointments] = await pool.execute(`
        SELECT a.id, a.date_time, a.status, a.reason,
               CONCAT(p.first_name, ' ', p.last_name) as patient_name,
               p.email as patient_email, p.phone as patient_phone,
               CONCAT(u.first_name, ' ', u.last_name) as doctor_name,
               d.specialization
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        JOIN doctors d ON a.doctor_id = d.id
        JOIN users u ON d.user_id = u.id
        WHERE DATE(a.date_time) = CURDATE()
        ORDER BY a.date_time ASC
      `);

      schedule = appointments;
    }

    res.json({ schedule });
  } catch (error) {
    console.error("Get today schedule error:", error);
    res.status(500).json({ message: "Failed to fetch today schedule" });
  }
});

// Get monthly statistics for charts
router.get("/monthly-stats", authenticateToken, async (req, res) => {
  try {
    const userRole = req.user.role;
    const months = 12; // Last 12 months

    let monthlyStats = {};

    if (userRole === "admin") {
      const [appointmentStats] = await pool.execute(
        `
        SELECT 
          DATE_FORMAT(created_at, '%Y-%m') as month,
          COUNT(*) as appointments
        FROM appointments 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? MONTH)
        GROUP BY DATE_FORMAT(created_at, '%Y-%m')
        ORDER BY month DESC
      `,
        [months]
      );

      const [billingStats] = await pool.execute(
        `
        SELECT 
          DATE_FORMAT(created_at, '%Y-%m') as month,
          COUNT(*) as bills,
          SUM(total_amount) as revenue
        FROM bills 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? MONTH)
        GROUP BY DATE_FORMAT(created_at, '%Y-%m')
        ORDER BY month DESC
      `,
        [months]
      );

      const [patientStats] = await pool.execute(
        `
        SELECT 
          DATE_FORMAT(created_at, '%Y-%m') as month,
          COUNT(*) as patients
        FROM patients 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? MONTH)
        GROUP BY DATE_FORMAT(created_at, '%Y-%m')
        ORDER BY month DESC
      `,
        [months]
      );

      monthlyStats = {
        appointments: appointmentStats,
        billing: billingStats,
        patients: patientStats,
      };
    }

    res.json({ monthlyStats });
  } catch (error) {
    console.error("Get monthly stats error:", error);
    res.status(500).json({ message: "Failed to fetch monthly statistics" });
  }
});

module.exports = router;
