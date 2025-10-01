const express = require("express");
const { authenticateToken, requireRole } = require("../middleware/auth");
const patientsController = require("../controllers/patientsController");

const router = express.Router();

// Get all patients
router.get("/", authenticateToken, patientsController.getAll);

// Get single patient by ID
router.get("/:id", authenticateToken, patientsController.getById);

// Create new patient (Reception and Admin only)
router.post(
  "/",
  authenticateToken,
  requireRole(["admin", "reception"]),
  patientsController.create
);

// Update patient (Reception and Admin only)
router.put(
  "/:id",
  authenticateToken,
  requireRole(["admin", "reception"]),
  patientsController.update
);

// Delete patient (Admin only)
router.delete(
  "/:id",
  authenticateToken,
  requireRole(["admin"]),
  patientsController.remove
);

// Get patient appointments
router.get(
  "/:id/appointments",
  authenticateToken,
  patientsController.getAppointments
);

// Get patient treatments
router.get(
  "/:id/treatments",
  authenticateToken,
  patientsController.getTreatments
);

// Get patient lab tests
router.get("/:id/lab-tests", authenticateToken, patientsController.getLabTests);

// Get patient bills
router.get("/:id/bills", authenticateToken, patientsController.getBills);

module.exports = router;
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [patients] = await pool.execute(
      `SELECT id, first_name, last_name, email, phone, date_of_birth, gender, 
              address, emergency_contact, emergency_phone, medical_history, 
              allergies, blood_group, created_at, updated_at
       FROM patients WHERE id = ?`,
      [id]
    );

    if (patients.length === 0) {
      return res.status(404).json({ message: "Patient not found" });
    }

    res.json({ patient: patients[0] });
  } catch (error) {
    console.error("Get patient error:", error);
    res.status(500).json({ message: "Failed to fetch patient" });
  }
});

// Create new patient (Reception and Admin only)
router.post(
  "/",
  authenticateToken,
  requireRole(["admin", "reception"]),
  async (req, res) => {
    try {
      const {
        firstName,
        lastName,
        email,
        phone,
        dateOfBirth,
        gender,
        address,
        emergencyContact,
        emergencyPhone,
        medicalHistory,
        allergies,
        bloodGroup,
      } = req.body;

      // Validate required fields
      if (
        !firstName ||
        !lastName ||
        !email ||
        !phone ||
        !dateOfBirth ||
        !address ||
        !emergencyContact ||
        !emergencyPhone
      ) {
        return res
          .status(400)
          .json({ message: "All required fields must be provided" });
      }

      // Check if patient with email already exists
      const [existingPatients] = await pool.execute(
        "SELECT id FROM patients WHERE email = ?",
        [email]
      );

      if (existingPatients.length > 0) {
        return res
          .status(409)
          .json({ message: "Patient with this email already exists" });
      }

      const patientId = uuidv4();

      await pool.execute(
        `INSERT INTO patients (id, first_name, last_name, email, phone, date_of_birth, gender, 
                           address, emergency_contact, emergency_phone, medical_history, 
                           allergies, blood_group)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          patientId,
          firstName,
          lastName,
          email,
          phone,
          dateOfBirth,
          gender,
          address,
          emergencyContact,
          emergencyPhone,
          medicalHistory || null,
          allergies || null,
          bloodGroup || null,
        ]
      );

      // Get the created patient
      const [newPatients] = await pool.execute(
        "SELECT * FROM patients WHERE id = ?",
        [patientId]
      );

      res.status(201).json({
        message: "Patient created successfully",
        patient: newPatients[0],
      });
    } catch (error) {
      console.error("Create patient error:", error);
      res.status(500).json({ message: "Failed to create patient" });
    }
  }
);

// Update patient (Reception and Admin only)
router.put(
  "/:id",
  authenticateToken,
  requireRole(["admin", "reception"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        firstName,
        lastName,
        email,
        phone,
        dateOfBirth,
        gender,
        address,
        emergencyContact,
        emergencyPhone,
        medicalHistory,
        allergies,
        bloodGroup,
      } = req.body;

      // Check if patient exists
      const [existingPatients] = await pool.execute(
        "SELECT id FROM patients WHERE id = ?",
        [id]
      );

      if (existingPatients.length === 0) {
        return res.status(404).json({ message: "Patient not found" });
      }

      // Check if email is being changed and if it conflicts
      if (email) {
        const [emailConflict] = await pool.execute(
          "SELECT id FROM patients WHERE email = ? AND id != ?",
          [email, id]
        );

        if (emailConflict.length > 0) {
          return res
            .status(409)
            .json({ message: "Patient with this email already exists" });
        }
      }

      await pool.execute(
        `UPDATE patients SET 
       first_name = ?, last_name = ?, email = ?, phone = ?, date_of_birth = ?, 
       gender = ?, address = ?, emergency_contact = ?, emergency_phone = ?, 
       medical_history = ?, allergies = ?, blood_group = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
        [
          firstName,
          lastName,
          email,
          phone,
          dateOfBirth,
          gender,
          address,
          emergencyContact,
          emergencyPhone,
          medicalHistory,
          allergies,
          bloodGroup,
          id,
        ]
      );

      res.json({ message: "Patient updated successfully" });
    } catch (error) {
      console.error("Update patient error:", error);
      res.status(500).json({ message: "Failed to update patient" });
    }
  }
);

// Delete patient (Admin only)
router.delete(
  "/:id",
  authenticateToken,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const { id } = req.params;

      // Check if patient exists
      const [patients] = await pool.execute(
        "SELECT id FROM patients WHERE id = ?",
        [id]
      );

      if (patients.length === 0) {
        return res.status(404).json({ message: "Patient not found" });
      }

      // Delete patient (cascade will handle related records)
      await pool.execute("DELETE FROM patients WHERE id = ?", [id]);

      res.json({ message: "Patient deleted successfully" });
    } catch (error) {
      console.error("Delete patient error:", error);
      res.status(500).json({ message: "Failed to delete patient" });
    }
  }
);

// Get patient appointments
router.get("/:id/appointments", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [appointments] = await pool.execute(
      `SELECT a.id, a.date_time, a.status, a.reason, a.notes, a.created_at,
              d.specialization, u.first_name as doctor_first_name, u.last_name as doctor_last_name
       FROM appointments a
       JOIN doctors d ON a.doctor_id = d.id
       JOIN users u ON d.user_id = u.id
       WHERE a.patient_id = ?
       ORDER BY a.date_time DESC`,
      [id]
    );

    res.json({ appointments });
  } catch (error) {
    console.error("Get patient appointments error:", error);
    res.status(500).json({ message: "Failed to fetch patient appointments" });
  }
});

// Get patient treatments
router.get("/:id/treatments", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [treatments] = await pool.execute(
      `SELECT t.id, t.diagnosis, t.prescription, t.notes, t.follow_up_date, t.created_at,
              d.specialization, u.first_name as doctor_first_name, u.last_name as doctor_last_name
       FROM treatments t
       JOIN doctors d ON t.doctor_id = d.id
       JOIN users u ON d.user_id = u.id
       WHERE t.patient_id = ?
       ORDER BY t.created_at DESC`,
      [id]
    );

    res.json({ treatments });
  } catch (error) {
    console.error("Get patient treatments error:", error);
    res.status(500).json({ message: "Failed to fetch patient treatments" });
  }
});

// Get patient lab tests
router.get("/:id/lab-tests", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [labTests] = await pool.execute(
      `SELECT lt.id, lt.test_name, lt.test_type, lt.status, lt.results, 
              lt.result_file, lt.normal_ranges, lt.technician, lt.completed_at, lt.created_at,
              d.specialization, u.first_name as doctor_first_name, u.last_name as doctor_last_name
       FROM lab_tests lt
       JOIN doctors d ON lt.doctor_id = d.id
       JOIN users u ON d.user_id = u.id
       WHERE lt.patient_id = ?
       ORDER BY lt.created_at DESC`,
      [id]
    );

    res.json({ labTests });
  } catch (error) {
    console.error("Get patient lab tests error:", error);
    res.status(500).json({ message: "Failed to fetch patient lab tests" });
  }
});

// Get patient bills
router.get("/:id/bills", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [bills] = await pool.execute(
      `SELECT b.id, b.total_amount, b.paid_amount, b.status, b.payment_method, 
              b.notes, b.created_at,
              d.specialization, u.first_name as doctor_first_name, u.last_name as doctor_last_name
       FROM bills b
       LEFT JOIN doctors d ON b.doctor_id = d.id
       LEFT JOIN users u ON d.user_id = u.id
       WHERE b.patient_id = ?
       ORDER BY b.created_at DESC`,
      [id]
    );

    // Get bill items for each bill
    for (let bill of bills) {
      const [items] = await pool.execute(
        "SELECT * FROM bill_items WHERE bill_id = ?",
        [bill.id]
      );
      bill.items = items;
    }

    res.json({ bills });
  } catch (error) {
    console.error("Get patient bills error:", error);
    res.status(500).json({ message: "Failed to fetch patient bills" });
  }
});

module.exports = router;
