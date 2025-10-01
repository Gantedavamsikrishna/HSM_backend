const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get dashboard statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let stats = {};

    // Common stats for all roles
    const [patientStats] = await pool.execute('SELECT COUNT(*) as total_patients FROM patients');
    const [appointmentStats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_appointments,
        SUM(CASE WHEN DATE(date_time) = CURDATE() THEN 1 ELSE 0 END) as today_appointments,
        SUM(CASE WHEN status = 'scheduled' AND DATE(date_time) = CURDATE() THEN 1 ELSE 0 END) as today_scheduled,
        SUM(CASE WHEN status = 'completed' AND DATE(date_time) = CURDATE() THEN 1 ELSE 0 END) as today_completed
      FROM appointments
    `);

    stats.totalPatients = patientStats[0].total_patients;
    stats.todayAppointments = appointmentStats[0].today_appointments;
    stats.totalAppointments = appointmentStats[0].total_appointments;

    // Role-specific stats
    if (userRole === 'admin') {
      // Admin gets all stats
      const [labStats] = await pool.execute(`
        SELECT 
          COUNT(*) as total_tests,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_tests,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tests
        FROM lab_tests
      `);

      const [billingStats] = await pool.execute(`
        SELECT 
          COUNT(*) as total_bills,
          SUM(total_amount) as total_revenue,
          SUM(paid_amount) as total_collected,
          SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_bills,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_bills
        FROM bills
      `);

      const [userStats] = await pool.execute(`
        SELECT 
          COUNT(*) as total_users,
          SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active_users
        FROM users
      `);

      const [doctorStats] = await pool.execute(`
        SELECT 
          COUNT(*) as total_doctors,
          COUNT(DISTINCT specialization) as specializations
        FROM doctors
      `);

      stats.pendingTests = labStats[0].pending_tests;
      stats.totalTests = labStats[0].total_tests;
      stats.totalRevenue = billingStats[0].total_revenue || 0;
      stats.totalCollected = billingStats[0].total_collected || 0;
      stats.totalBills = billingStats[0].total_bills;
      stats.paidBills = billingStats[0].paid_bills;
      stats.pendingBills = billingStats[0].pending_bills;
      stats.totalUsers = userStats[0].total_users;
      stats.activeUsers = userStats[0].active_users;
      stats.totalDoctors = doctorStats[0].total_doctors;
      stats.specializations = doctorStats[0].specializations;

    } else if (userRole === 'doctor') {
      // Doctor gets stats for their patients and appointments
      const [doctorRecord] = await pool.execute(
        'SELECT id FROM doctors WHERE user_id = ?',
        [userId]
      );

      if (doctorRecord.length > 0) {
        const doctorId = doctorRecord[0].id;

        const [doctorPatientStats] = await pool.execute(`
          SELECT COUNT(DISTINCT patient_id) as my_patients
          FROM appointments 
          WHERE doctor_id = ?
        `, [doctorId]);

        const [doctorAppointmentStats] = await pool.execute(`
          SELECT 
            COUNT(*) as my_appointments,
            SUM(CASE WHEN DATE(date_time) = CURDATE() THEN 1 ELSE 0 END) as my_today_appointments,
            SUM(CASE WHEN status = 'scheduled' AND DATE(date_time) = CURDATE() THEN 1 ELSE 0 END) as my_today_scheduled
          FROM appointments 
          WHERE doctor_id = ?
        `, [doctorId]);

        const [doctorLabStats] = await pool.execute(`
          SELECT 
            COUNT(*) as my_lab_tests,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as my_pending_tests
          FROM lab_tests 
          WHERE doctor_id = ?
        `, [doctorId]);

        const [doctorTreatmentStats] = await pool.execute(`
          SELECT COUNT(*) as my_treatments
          FROM treatments 
          WHERE doctor_id = ?
        `, [doctorId]);

        stats.myPatients = doctorPatientStats[0].my_patients;
        stats.myAppointments = doctorAppointmentStats[0].my_appointments;
        stats.myTodayAppointments = doctorAppointmentStats[0].my_today_appointments;
        stats.myTodayScheduled = doctorAppointmentStats[0].my_today_scheduled;
        stats.pendingTests = doctorLabStats[0].my_pending_tests;
        stats.myLabTests = doctorLabStats[0].my_lab_tests;
        stats.myTreatments = doctorTreatmentStats[0].my_treatments;
      }

    } else if (userRole === 'reception') {
      // Reception gets billing and appointment stats
      const [billingStats] = await pool.execute(`
        SELECT 
          COUNT(*) as total_bills,
          SUM(total_amount) as total_revenue,
          SUM(paid_amount) as total_collected,
          SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_bills,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_bills,
          SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today_bills
        FROM bills
      `);

      const [receptionAppointmentStats] = await pool.execute(`
        SELECT 
          SUM(CASE WHEN status = 'scheduled' AND DATE(date_time) = CURDATE() THEN 1 ELSE 0 END) as today_scheduled,
          SUM(CASE WHEN status = 'completed' AND DATE(date_time) = CURDATE() THEN 1 ELSE 0 END) as today_completed
        FROM appointments
      `);

      stats.totalRevenue = billingStats[0].total_revenue || 0;
      stats.totalCollected = billingStats[0].total_collected || 0;
      stats.totalBills = billingStats[0].total_bills;
      stats.paidBills = billingStats[0].paid_bills;
      stats.pendingBills = billingStats[0].pending_bills;
      stats.todayBills = billingStats[0].today_bills;
      stats.todayScheduled = receptionAppointmentStats[0].today_scheduled;
      stats.todayCompleted = receptionAppointmentStats[0].today_completed;

    } else if (userRole === 'lab') {
      // Lab gets lab test stats
      const [labStats] = await pool.execute(`
        SELECT 
          COUNT(*) as total_tests,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_tests,
          SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_tests,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tests,
          SUM(CASE WHEN status = 'completed' AND DATE(completed_at) = CURDATE() THEN 1 ELSE 0 END) as today_completed,
          SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today_received
        FROM lab_tests
      `);

      stats.pendingTests = labStats[0].pending_tests;
      stats.processingTests = labStats[0].processing_tests;
      stats.completedTests = labStats[0].completed_tests;
      stats.totalTests = labStats[0].total_tests;
      stats.todayCompleted = labStats[0].today_completed;
      stats.todayReceived = labStats[0].today_received;
    }

    res.json({ stats });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard statistics' });
  }
});

// Get recent activities
router.get('/recent-activities', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const limit = parseInt(req.query.limit) || 10;

    let activities = [];

    if (userRole === 'admin') {
      // Admin sees all recent activities
      const [recentPatients] = await pool.execute(`
        SELECT 'patient' as type, first_name, last_name, created_at
        FROM patients 
        ORDER BY created_at DESC 
        LIMIT ?
      `, [Math.ceil(limit / 4)]);

      const [recentAppointments] = await pool.execute(`
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
      `, [Math.ceil(limit / 4)]);

      const [recentBills] = await pool.execute(`
        SELECT 'bill' as type,
               CONCAT(p.first_name, ' ', p.last_name) as patient_name,
               total_amount,
               status,
               created_at
        FROM bills b
        JOIN patients p ON b.patient_id = p.id
        ORDER BY b.created_at DESC 
        LIMIT ?
      `, [Math.ceil(limit / 4)]);

      const [recentLabTests] = await pool.execute(`
        SELECT 'lab_test' as type,
               CONCAT(p.first_name, ' ', p.last_name) as patient_name,
               test_name,
               status,
               created_at
        FROM lab_tests lt
        JOIN patients p ON lt.patient_id = p.id
        ORDER BY lt.created_at DESC 
        LIMIT ?
      `, [Math.ceil(limit / 4)]);

      activities = [
        ...recentPatients.map(a => ({ ...a, activity: `New patient registered: ${a.first_name} ${a.last_name}` })),
        ...recentAppointments.map(a => ({ ...a, activity: `Appointment scheduled: ${a.patient_name} with Dr. ${a.doctor_name}` })),
        ...recentBills.map(a => ({ ...a, activity: `Bill created: ${a.patient_name} - $${a.total_amount}` })),
        ...recentLabTests.map(a => ({ ...a, activity: `Lab test: ${a.test_name} for ${a.patient_name}` }))
      ];

    } else if (userRole === 'doctor') {
      // Doctor sees their related activities
      const [doctorRecord] = await pool.execute(
        'SELECT id FROM doctors WHERE user_id = ?',
        [userId]
      );

      if (doctorRecord.length > 0) {
        const doctorId = doctorRecord[0].id;

        const [doctorAppointments] = await pool.execute(`
          SELECT 'appointment' as type,
                 CONCAT(p.first_name, ' ', p.last_name) as patient_name,
                 date_time as created_at,
                 status
          FROM appointments a
          JOIN patients p ON a.patient_id = p.id
          WHERE a.doctor_id = ?
          ORDER BY a.created_at DESC 
          LIMIT ?
        `, [doctorId, Math.ceil(limit / 2)]);

        const [doctorTreatments] = await pool.execute(`
          SELECT 'treatment' as type,
                 CONCAT(p.first_name, ' ', p.last_name) as patient_name,
                 diagnosis,
                 created_at
          FROM treatments t
          JOIN patients p ON t.patient_id = p.id
          WHERE t.doctor_id = ?
          ORDER BY t.created_at DESC 
          LIMIT ?
        `, [doctorId, Math.ceil(limit / 2)]);

        activities = [
          ...doctorAppointments.map(a => ({ ...a, activity: `Appointment: ${a.patient_name} - ${a.status}` })),
          ...doctorTreatments.map(a => ({ ...a, activity: `Treatment: ${a.patient_name} - ${a.diagnosis}` }))
        ];
      }

    } else if (userRole === 'reception') {
      // Reception sees patient and billing activities
      const [receptionPatients] = await pool.execute(`
        SELECT 'patient' as type, first_name, last_name, created_at
        FROM patients 
        ORDER BY created_at DESC 
        LIMIT ?
      `, [Math.ceil(limit / 2)]);

      const [receptionBills] = await pool.execute(`
        SELECT 'bill' as type,
               CONCAT(p.first_name, ' ', p.last_name) as patient_name,
               total_amount,
               status,
               created_at
        FROM bills b
        JOIN patients p ON b.patient_id = p.id
        ORDER BY b.created_at DESC 
        LIMIT ?
      `, [Math.ceil(limit / 2)]);

      activities = [
        ...receptionPatients.map(a => ({ ...a, activity: `New patient: ${a.first_name} ${a.last_name}` })),
        ...receptionBills.map(a => ({ ...a, activity: `Bill: ${a.patient_name} - $${a.total_amount} (${a.status})` }))
      ];

    } else if (userRole === 'lab') {
      // Lab sees lab test activities
      const [labActivities] = await pool.execute(`
        SELECT 'lab_test' as type,
               CONCAT(p.first_name, ' ', p.last_name) as patient_name,
               test_name,
               status,
               created_at
        FROM lab_tests lt
        JOIN patients p ON lt.patient_id = p.id
        ORDER BY lt.created_at DESC 
        LIMIT ?
      `, [limit]);

      activities = labActivities.map(a => ({ 
        ...a, 
        activity: `${a.test_name} for ${a.patient_name} - ${a.status}` 
      }));
    }

    // Sort all activities by date and limit
    activities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    activities = activities.slice(0, limit);

    res.json({ activities });

  } catch (error) {
    console.error('Get recent activities error:', error);
    res.status(500).json({ message: 'Failed to fetch recent activities' });
  }
});

// Get today's schedule (for doctors and reception)
router.get('/today-schedule', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let schedule = [];

    if (userRole === 'doctor') {
      const [doctorRecord] = await pool.execute(
        'SELECT id FROM doctors WHERE user_id = ?',
        [userId]
      );

      if (doctorRecord.length > 0) {
        const doctorId = doctorRecord[0].id;

        const [appointments] = await pool.execute(`
          SELECT a.id, a.date_time, a.status, a.reason, a.notes,
                 CONCAT(p.first_name, ' ', p.last_name) as patient_name,
                 p.email as patient_email, p.phone as patient_phone
          FROM appointments a
          JOIN patients p ON a.patient_id = p.id
          WHERE a.doctor_id = ? AND DATE(a.date_time) = CURDATE()
          ORDER BY a.date_time ASC
        `, [doctorId]);

        schedule = appointments;
      }

    } else if (userRole === 'reception' || userRole === 'admin') {
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
    console.error('Get today schedule error:', error);
    res.status(500).json({ message: 'Failed to fetch today schedule' });
  }
});

// Get monthly statistics for charts
router.get('/monthly-stats', authenticateToken, async (req, res) => {
  try {
    const userRole = req.user.role;
    const months = 12; // Last 12 months

    let monthlyStats = {};

    if (userRole === 'admin') {
      const [appointmentStats] = await pool.execute(`
        SELECT 
          DATE_FORMAT(created_at, '%Y-%m') as month,
          COUNT(*) as appointments
        FROM appointments 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? MONTH)
        GROUP BY DATE_FORMAT(created_at, '%Y-%m')
        ORDER BY month DESC
      `, [months]);

      const [billingStats] = await pool.execute(`
        SELECT 
          DATE_FORMAT(created_at, '%Y-%m') as month,
          COUNT(*) as bills,
          SUM(total_amount) as revenue
        FROM bills 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? MONTH)
        GROUP BY DATE_FORMAT(created_at, '%Y-%m')
        ORDER BY month DESC
      `, [months]);

      const [patientStats] = await pool.execute(`
        SELECT 
          DATE_FORMAT(created_at, '%Y-%m') as month,
          COUNT(*) as patients
        FROM patients 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? MONTH)
        GROUP BY DATE_FORMAT(created_at, '%Y-%m')
        ORDER BY month DESC
      `, [months]);

      monthlyStats = {
        appointments: appointmentStats,
        billing: billingStats,
        patients: patientStats
      };
    }

    res.json({ monthlyStats });

  } catch (error) {
    console.error('Get monthly stats error:', error);
    res.status(500).json({ message: 'Failed to fetch monthly statistics' });
  }
});

module.exports = router;
