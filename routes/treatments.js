const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { pool } = require("../config/database");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();

// Get all treatments (with pagination and filters)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const doctorId = req.query.doctor_id || "";
    const patientId = req.query.patient_id || "";
    const offset = (page - 1) * limit;

    let query = `
      SELECT t.id, t.patient_id, t.doctor_id, t.appointment_id, t.diagnosis, 
             t.prescription, t.notes, t.follow_up_date, t.created_at,
             p.first_name as patient_first_name, p.last_name as patient_last_name,
             p.email as patient_email, p.phone as patient_phone,
             d.specialization, u.first_name as doctor_first_name, u.last_name as doctor_last_name
      FROM treatments t
      JOIN patients p ON t.patient_id = p.id
      JOIN doctors d ON t.doctor_id = d.id
      JOIN users u ON d.user_id = u.id
      WHERE 1=1
    `;
    let params = [];

    // Add search filter
    if (search) {
      query += ` AND (p.first_name LIKE ? OR p.last_name LIKE ? OR t.diagnosis LIKE ? OR t.prescription LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // Add doctor filter
    if (doctorId) {
      query += ` AND t.doctor_id = ?`;
      params.push(doctorId);
    }

    // Add patient filter
    if (patientId) {
      query += ` AND t.patient_id = ?`;
      params.push(patientId);
    }

    // Role-based filtering
    if (req.user.role === "doctor") {
      const [doctorRecord] = await pool.execute(
        "SELECT id FROM doctors WHERE user_id = ?",
        [req.user.id]
      );
      if (doctorRecord.length > 0) {
        query += ` AND t.doctor_id = ?`;
        params.push(doctorRecord[0].id);
      }
    }

    // Add ordering and pagination
    query += ` ORDER BY t.created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    const [treatments] = await pool.execute(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total FROM treatments t
      JOIN patients p ON t.patient_id = p.id
      JOIN doctors d ON t.doctor_id = d.id
      JOIN users u ON d.user_id = u.id
      WHERE 1=1
    `;
    let countParams = [];

    if (search) {
      countQuery += ` AND (p.first_name LIKE ? OR p.last_name LIKE ? OR t.diagnosis LIKE ? OR t.prescription LIKE ?)`;
      const searchPattern = `%${search}%`;
      countParams.push(
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern
      );
    }

    if (doctorId) {
      countQuery += ` AND t.doctor_id = ?`;
      countParams.push(doctorId);
    }

    if (patientId) {
      countQuery += ` AND t.patient_id = ?`;
      countParams.push(patientId);
    }

    if (req.user.role === "doctor") {
      const [doctorRecord] = await pool.execute(
        "SELECT id FROM doctors WHERE user_id = ?",
        [req.user.id]
      );
      if (doctorRecord.length > 0) {
        countQuery += ` AND t.doctor_id = ?`;
        countParams.push(doctorRecord[0].id);
      }
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    res.json({
      treatments,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Get treatments error:", error);
    res.status(500).json({ message: "Failed to fetch treatments" });
  }
});

// Get single treatment by ID
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [treatments] = await pool.execute(
      `SELECT t.*, p.first_name as patient_first_name, p.last_name as patient_last_name,
              p.email as patient_email, p.phone as patient_phone, p.date_of_birth, p.gender,
              p.address, p.emergency_contact, p.emergency_phone, p.medical_history, p.allergies, p.blood_group,
              d.specialization, u.first_name as doctor_first_name, u.last_name as doctor_last_name,
              a.date_time as appointment_date_time, a.reason as appointment_reason
       FROM treatments t
       JOIN patients p ON t.patient_id = p.id
       JOIN doctors d ON t.doctor_id = d.id
       JOIN users u ON d.user_id = u.id
       LEFT JOIN appointments a ON t.appointment_id = a.id
       WHERE t.id = ?`,
      [id]
    );

    if (treatments.length === 0) {
      return res.status(404).json({ message: "Treatment not found" });
    }

    res.json({ treatment: treatments[0] });
  } catch (error) {
    console.error("Get treatment error:", error);
    res.status(500).json({ message: "Failed to fetch treatment" });
  }
});

// Create new treatment (Doctor and Admin only)
router.post(
  "/",
  authenticateToken,
  requireRole(["admin", "doctor"]),
  async (req, res) => {
    try {
      const {
        patientId,
        doctorId,
        appointmentId,
        diagnosis,
        prescription,
        notes,
        followUpDate,
      } = req.body;

      // Validate required fields
      if (!patientId || !doctorId || !diagnosis) {
        return res
          .status(400)
          .json({
            message: "Patient ID, doctor ID, and diagnosis are required",
          });
      }

      // Validate patient exists
      const [patients] = await pool.execute(
        "SELECT id FROM patients WHERE id = ?",
        [patientId]
      );

      if (patients.length === 0) {
        return res.status(404).json({ message: "Patient not found" });
      }

      // Validate doctor exists
      const [doctors] = await pool.execute(
        "SELECT id FROM doctors WHERE id = ?",
        [doctorId]
      );

      if (doctors.length === 0) {
        return res.status(404).json({ message: "Doctor not found" });
      }

      // Validate appointment exists if provided
      if (appointmentId) {
        const [appointments] = await pool.execute(
          "SELECT id FROM appointments WHERE id = ? AND patient_id = ? AND doctor_id = ?",
          [appointmentId, patientId, doctorId]
        );

        if (appointments.length === 0) {
          return res
            .status(404)
            .json({
              message: "Appointment not found or does not match patient/doctor",
            });
        }
      }

      // Role-based access control
      if (req.user.role === "doctor") {
        const [doctorRecord] = await pool.execute(
          "SELECT id FROM doctors WHERE user_id = ?",
          [req.user.id]
        );
        if (doctorRecord.length > 0 && doctorId !== doctorRecord[0].id) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const treatmentId = uuidv4();

      await pool.execute(
        "INSERT INTO treatments (id, patient_id, doctor_id, appointment_id, diagnosis, prescription, notes, follow_up_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          treatmentId,
          patientId,
          doctorId,
          appointmentId || null,
          diagnosis,
          prescription || null,
          notes || null,
          followUpDate || null,
        ]
      );

      // Get the created treatment
      const [newTreatments] = await pool.execute(
        `SELECT t.*, p.first_name as patient_first_name, p.last_name as patient_last_name,
              d.specialization, u.first_name as doctor_first_name, u.last_name as doctor_last_name
       FROM treatments t
       JOIN patients p ON t.patient_id = p.id
       JOIN doctors d ON t.doctor_id = d.id
       JOIN users u ON d.user_id = u.id
       WHERE t.id = ?`,
        [treatmentId]
      );

      res.status(201).json({
        message: "Treatment created successfully",
        treatment: newTreatments[0],
      });
    } catch (error) {
      console.error("Create treatment error:", error);
      res.status(500).json({ message: "Failed to create treatment" });
    }
  }
);

// Update treatment (Doctor and Admin only)
router.put(
  "/:id",
  authenticateToken,
  requireRole(["admin", "doctor"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { diagnosis, prescription, notes, followUpDate } = req.body;

      // Check if treatment exists
      const [existingTreatments] = await pool.execute(
        "SELECT id, doctor_id FROM treatments WHERE id = ?",
        [id]
      );

      if (existingTreatments.length === 0) {
        return res.status(404).json({ message: "Treatment not found" });
      }

      // Role-based access control
      if (req.user.role === "doctor") {
        const [doctorRecord] = await pool.execute(
          "SELECT id FROM doctors WHERE user_id = ?",
          [req.user.id]
        );
        if (
          doctorRecord.length > 0 &&
          existingTreatments[0].doctor_id !== doctorRecord[0].id
        ) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      // Build update query dynamically
      const updates = [];
      const values = [];

      if (diagnosis) {
        updates.push("diagnosis = ?");
        values.push(diagnosis);
      }
      if (prescription !== undefined) {
        updates.push("prescription = ?");
        values.push(prescription);
      }
      if (notes !== undefined) {
        updates.push("notes = ?");
        values.push(notes);
      }
      if (followUpDate !== undefined) {
        updates.push("follow_up_date = ?");
        values.push(followUpDate);
      }

      if (updates.length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }

      values.push(id);

      await pool.execute(
        `UPDATE treatments SET ${updates.join(", ")} WHERE id = ?`,
        values
      );

      res.json({ message: "Treatment updated successfully" });
    } catch (error) {
      console.error("Update treatment error:", error);
      res.status(500).json({ message: "Failed to update treatment" });
    }
  }
);

// Delete treatment (Admin only)
router.delete(
  "/:id",
  authenticateToken,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const { id } = req.params;

      // Check if treatment exists
      const [treatments] = await pool.execute(
        "SELECT id FROM treatments WHERE id = ?",
        [id]
      );

      if (treatments.length === 0) {
        return res.status(404).json({ message: "Treatment not found" });
      }

      // Delete treatment
      await pool.execute("DELETE FROM treatments WHERE id = ?", [id]);

      res.json({ message: "Treatment deleted successfully" });
    } catch (error) {
      console.error("Delete treatment error:", error);
      res.status(500).json({ message: "Failed to delete treatment" });
    }
  }
);

// Get treatments by patient
router.get("/patient/:patientId", authenticateToken, async (req, res) => {
  try {
    const { patientId } = req.params;

    const [treatments] = await pool.execute(
      `SELECT t.*, d.specialization, u.first_name as doctor_first_name, u.last_name as doctor_last_name
       FROM treatments t
       JOIN doctors d ON t.doctor_id = d.id
       JOIN users u ON d.user_id = u.id
       WHERE t.patient_id = ?
       ORDER BY t.created_at DESC`,
      [patientId]
    );

    res.json({ treatments });
  } catch (error) {
    console.error("Get patient treatments error:", error);
    res.status(500).json({ message: "Failed to fetch patient treatments" });
  }
});

// Get treatments by doctor
router.get("/doctor/:doctorId", authenticateToken, async (req, res) => {
  try {
    const { doctorId } = req.params;

    const [treatments] = await pool.execute(
      `SELECT t.*, p.first_name as patient_first_name, p.last_name as patient_last_name,
              p.email as patient_email, p.phone as patient_phone
       FROM treatments t
       JOIN patients p ON t.patient_id = p.id
       WHERE t.doctor_id = ?
       ORDER BY t.created_at DESC`,
      [doctorId]
    );

    res.json({ treatments });
  } catch (error) {
    console.error("Get doctor treatments error:", error);
    res.status(500).json({ message: "Failed to fetch doctor treatments" });
  }
});

module.exports = router;
