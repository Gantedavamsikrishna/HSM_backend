const express = require("express");
const { authenticateToken, requireRole } = require("../middleware/auth");
const appointmentsController = require("../controllers/appointmentsController");

const router = express.Router();

// Get all appointments
router.get("/", authenticateToken, appointmentsController.getAll);

// Get single appointment by ID
router.get("/:id", authenticateToken, appointmentsController.getById);

// Create new appointment (Reception and Admin only)
router.post(
  "/",
  authenticateToken,
  requireRole(["admin", "reception"]),
  appointmentsController.create
);

// Update appointment (Reception and Admin only)
router.put(
  "/:id",
  authenticateToken,
  requireRole(["admin", "reception"]),
  appointmentsController.update
);

// Delete appointment (Admin only)
router.delete(
  "/:id",
  authenticateToken,
  requireRole(["admin"]),
  appointmentsController.remove
);

module.exports = router;

// Get single appointment by ID
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [appointments] = await pool.execute(
      `SELECT a.*, p.first_name as patient_first_name, p.last_name as patient_last_name,
              p.email as patient_email, p.phone as patient_phone, p.date_of_birth, p.gender,
              p.address, p.emergency_contact, p.emergency_phone, p.medical_history, p.allergies, p.blood_group,
              d.specialization, d.consultation_fee, u.first_name as doctor_first_name, u.last_name as doctor_last_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN doctors d ON a.doctor_id = d.id
       JOIN users u ON d.user_id = u.id
       WHERE a.id = ?`,
      [id]
    );

    if (appointments.length === 0) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    res.json({ appointment: appointments[0] });
  } catch (error) {
    console.error("Get appointment error:", error);
    res.status(500).json({ message: "Failed to fetch appointment" });
  }
});

router.post(
  "/",
  authenticateToken,
  requireRole(["admin", "reception"]),
  async (req, res) => {
    try {
      const { patientId, doctorId, dateTime, reason, notes } = req.body;

      if (!patientId || !doctorId || !dateTime || !reason) {
        return res.status(400).json({
          message: "Patient ID, doctor ID, date/time, and reason are required",
        });
      }

      const [patients] = await pool.execute(
        "SELECT id FROM patients WHERE id = ?",
        [patientId]
      );

      if (patients.length === 0) {
        return res.status(404).json({ message: "Patient not found" });
      }

      const [doctors] = await pool.execute(
        "SELECT id FROM doctors WHERE id = ?",
        [doctorId]
      );

      if (doctors.length === 0) {
        return res.status(404).json({ message: "Doctor not found" });
      }

      const [conflicts] = await pool.execute(
        'SELECT id FROM appointments WHERE doctor_id = ? AND date_time = ? AND status != "cancelled"',
        [doctorId, dateTime]
      );

      if (conflicts.length > 0) {
        return res.status(409).json({
          message: "Doctor has a conflicting appointment at this time",
        });
      }

      const appointmentId = uuidv4();

      await pool.execute(
        "INSERT INTO appointments (id, patient_id, doctor_id, date_time, status, reason, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          appointmentId,
          patientId,
          doctorId,
          dateTime,
          "scheduled",
          reason,
          notes || null,
        ]
      );

      const [newAppointments] = await pool.execute(
        `SELECT a.*, p.first_name as patient_first_name, p.last_name as patient_last_name,
              d.specialization, u.first_name as doctor_first_name, u.last_name as doctor_last_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN doctors d ON a.doctor_id = d.id
       JOIN users u ON d.user_id = u.id
       WHERE a.id = ?`,
        [appointmentId]
      );

      res.status(201).json({
        message: "Appointment created successfully",
        appointment: newAppointments[0],
      });
    } catch (error) {
      console.error("Create appointment error:", error);
      res.status(500).json({ message: "Failed to create appointment" });
    }
  }
);

router.put(
  "/:id",
  authenticateToken,
  requireRole(["admin", "reception", "doctor"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { dateTime, reason, notes, status } = req.body;

      const [existingAppointments] = await pool.execute(
        "SELECT id, doctor_id FROM appointments WHERE id = ?",
        [id]
      );

      if (existingAppointments.length === 0) {
        return res.status(404).json({ message: "Appointment not found" });
      }

      if (req.user.role === "doctor") {
        const [doctorRecord] = await pool.execute(
          "SELECT id FROM doctors WHERE user_id = ?",
          [req.user.id]
        );
        if (
          doctorRecord.length > 0 &&
          existingAppointments[0].doctor_id !== doctorRecord[0].id
        ) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      if (dateTime) {
        const [conflicts] = await pool.execute(
          'SELECT id FROM appointments WHERE doctor_id = ? AND date_time = ? AND id != ? AND status != "cancelled"',
          [existingAppointments[0].doctor_id, dateTime, id]
        );

        if (conflicts.length > 0) {
          return res.status(409).json({
            message: "Doctor has a conflicting appointment at this time",
          });
        }
      }

      const updates = [];
      const values = [];

      if (dateTime) {
        updates.push("date_time = ?");
        values.push(dateTime);
      }
      if (reason) {
        updates.push("reason = ?");
        values.push(reason);
      }
      if (notes !== undefined) {
        updates.push("notes = ?");
        values.push(notes);
      }
      if (status) {
        updates.push("status = ?");
        values.push(status);
      }

      if (updates.length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }

      values.push(id);

      await pool.execute(
        `UPDATE appointments SET ${updates.join(
          ", "
        )}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values
      );

      res.json({ message: "Appointment updated successfully" });
    } catch (error) {
      console.error("Update appointment error:", error);
      res.status(500).json({ message: "Failed to update appointment" });
    }
  }
);

router.put(
  "/:id/cancel",
  authenticateToken,
  requireRole(["admin", "reception", "doctor"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const [appointments] = await pool.execute(
        "SELECT id, doctor_id, status FROM appointments WHERE id = ?",
        [id]
      );

      if (appointments.length === 0) {
        return res.status(404).json({ message: "Appointment not found" });
      }

      if (appointments[0].status === "cancelled") {
        return res
          .status(400)
          .json({ message: "Appointment is already cancelled" });
      }

      if (req.user.role === "doctor") {
        const [doctorRecord] = await pool.execute(
          "SELECT id FROM doctors WHERE user_id = ?",
          [req.user.id]
        );
        if (
          doctorRecord.length > 0 &&
          appointments[0].doctor_id !== doctorRecord[0].id
        ) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      await pool.execute(
        'UPDATE appointments SET status = "cancelled", notes = CONCAT(IFNULL(notes, ""), "\nCancelled: ", ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [reason || "No reason provided", id]
      );

      res.json({ message: "Appointment cancelled successfully" });
    } catch (error) {
      console.error("Cancel appointment error:", error);
      res.status(500).json({ message: "Failed to cancel appointment" });
    }
  }
);

router.put(
  "/:id/complete",
  authenticateToken,
  requireRole(["admin", "doctor"]),
  async (req, res) => {
    try {
      const { id } = req.params;

      const [appointments] = await pool.execute(
        "SELECT id, doctor_id, status FROM appointments WHERE id = ?",
        [id]
      );

      if (appointments.length === 0) {
        return res.status(404).json({ message: "Appointment not found" });
      }

      if (appointments[0].status !== "scheduled") {
        return res
          .status(400)
          .json({ message: "Only scheduled appointments can be completed" });
      }

      if (req.user.role === "doctor") {
        const [doctorRecord] = await pool.execute(
          "SELECT id FROM doctors WHERE user_id = ?",
          [req.user.id]
        );
        if (
          doctorRecord.length > 0 &&
          appointments[0].doctor_id !== doctorRecord[0].id
        ) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      await pool.execute(
        'UPDATE appointments SET status = "completed", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );

      res.json({ message: "Appointment completed successfully" });
    } catch (error) {
      console.error("Complete appointment error:", error);
      res.status(500).json({ message: "Failed to complete appointment" });
    }
  }
);

router.delete(
  "/:id",
  authenticateToken,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const { id } = req.params;

      const [appointments] = await pool.execute(
        "SELECT id FROM appointments WHERE id = ?",
        [id]
      );

      if (appointments.length === 0) {
        return res.status(404).json({ message: "Appointment not found" });
      }

      await pool.execute("DELETE FROM appointments WHERE id = ?", [id]);

      res.json({ message: "Appointment deleted successfully" });
    } catch (error) {
      console.error("Delete appointment error:", error);
      res.status(500).json({ message: "Failed to delete appointment" });
    }
  }
);

router.get("/today/list", authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT a.id, a.patient_id, a.doctor_id, a.date_time, a.status, a.reason, a.notes,
             p.first_name as patient_first_name, p.last_name as patient_last_name,
             p.email as patient_email, p.phone as patient_phone,
             d.specialization, u.first_name as doctor_first_name, u.last_name as doctor_last_name
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN doctors d ON a.doctor_id = d.id
      JOIN users u ON d.user_id = u.id
      WHERE DATE(a.date_time) = CURDATE()
    `;
    let params = [];

    if (req.user.role === "doctor") {
      const [doctorRecord] = await pool.execute(
        "SELECT id FROM doctors WHERE user_id = ?",
        [req.user.id]
      );
      if (doctorRecord.length > 0) {
        query += ` AND a.doctor_id = ?`;
        params.push(doctorRecord[0].id);
      }
    }

    query += ` ORDER BY a.date_time ASC`;

    const [appointments] = await pool.execute(query, params);

    res.json({ appointments });
  } catch (error) {
    console.error("Get today appointments error:", error);
    res.status(500).json({ message: "Failed to fetch today appointments" });
  }
});

router.get("/stats/overview", authenticateToken, async (req, res) => {
  try {
    const [stats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_appointments,
        SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled_appointments,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_appointments,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_appointments,
        SUM(CASE WHEN status = 'no-show' THEN 1 ELSE 0 END) as no_show_appointments,
        SUM(CASE WHEN DATE(date_time) = CURDATE() THEN 1 ELSE 0 END) as today_appointments
      FROM appointments
    `);

    res.json({ overview: stats[0] });
  } catch (error) {
    console.error("Get appointment stats error:", error);
    res.status(500).json({ message: "Failed to fetch appointment statistics" });
  }
});

module.exports = router;
