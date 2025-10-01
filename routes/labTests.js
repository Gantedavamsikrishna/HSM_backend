const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { pool } = require("../config/database");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();

// File upload and storage logic removed

// Get all lab tests (with pagination and filters)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const status = req.query.status || "";
    const doctorId = req.query.doctor_id || "";
    const patientId = req.query.patient_id || "";
    const offset = (page - 1) * limit;

    let query = `
      SELECT lt.id, lt.patient_id, lt.doctor_id, lt.test_name, lt.test_type, 
             lt.status, lt.results, lt.result_file, lt.normal_ranges, lt.technician, 
             lt.completed_at, lt.created_at,
             p.first_name as patient_first_name, p.last_name as patient_last_name,
             p.email as patient_email, p.phone as patient_phone,
             d.specialization, u.first_name as doctor_first_name, u.last_name as doctor_last_name
      FROM lab_tests lt
      JOIN patients p ON lt.patient_id = p.id
      JOIN doctors d ON lt.doctor_id = d.id
      JOIN users u ON d.user_id = u.id
      WHERE 1=1
    `;
    let params = [];

    // Add search filter
    if (search) {
      query += ` AND (p.first_name LIKE ? OR p.last_name LIKE ? OR lt.test_name LIKE ? OR lt.test_type LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // Add status filter
    if (status) {
      query += ` AND lt.status = ?`;
      params.push(status);
    }

    // Add doctor filter
    if (doctorId) {
      query += ` AND lt.doctor_id = ?`;
      params.push(doctorId);
    }

    // Add patient filter
    if (patientId) {
      query += ` AND lt.patient_id = ?`;
      params.push(patientId);
    }

    // Role-based filtering
    if (req.user.role === "doctor") {
      const [doctorRecord] = await pool.execute(
        "SELECT id FROM doctors WHERE user_id = ?",
        [req.user.id]
      );
      if (doctorRecord.length > 0) {
        query += ` AND lt.doctor_id = ?`;
        params.push(doctorRecord[0].id);
      }
    } else if (req.user.role === "lab") {
      // Lab users can see all tests but with different permissions
    }

    // Add ordering and pagination (inline limit/offset to avoid MySQL argument error)
    query += ` ORDER BY lt.created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    const [labTests] = await pool.execute(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total FROM lab_tests lt
      JOIN patients p ON lt.patient_id = p.id
      JOIN doctors d ON lt.doctor_id = d.id
      JOIN users u ON d.user_id = u.id
      WHERE 1=1
    `;
    let countParams = [];

    if (search) {
      countQuery += ` AND (p.first_name LIKE ? OR p.last_name LIKE ? OR lt.test_name LIKE ? OR lt.test_type LIKE ?)`;
      const searchPattern = `%${search}%`;
      countParams.push(
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern
      );
    }

    if (status) {
      countQuery += ` AND lt.status = ?`;
      countParams.push(status);
    }

    if (doctorId) {
      countQuery += ` AND lt.doctor_id = ?`;
      countParams.push(doctorId);
    }

    if (patientId) {
      countQuery += ` AND lt.patient_id = ?`;
      countParams.push(patientId);
    }

    if (req.user.role === "doctor") {
      const [doctorRecord] = await pool.execute(
        "SELECT id FROM doctors WHERE user_id = ?",
        [req.user.id]
      );
      if (doctorRecord.length > 0) {
        countQuery += ` AND lt.doctor_id = ?`;
        countParams.push(doctorRecord[0].id);
      }
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    res.json({
      labTests,
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
    console.error("Get lab tests error:", error);
    res.status(500).json({ message: "Failed to fetch lab tests" });
  }
});

// Get single lab test by ID
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [labTests] = await pool.execute(
      `SELECT lt.*, p.first_name as patient_first_name, p.last_name as patient_last_name,
              p.email as patient_email, p.phone as patient_phone, p.date_of_birth, p.gender,
              p.address, p.emergency_contact, p.emergency_phone, p.medical_history, p.allergies, p.blood_group,
              d.specialization, u.first_name as doctor_first_name, u.last_name as doctor_last_name
       FROM lab_tests lt
       JOIN patients p ON lt.patient_id = p.id
       JOIN doctors d ON lt.doctor_id = d.id
       JOIN users u ON d.user_id = u.id
       WHERE lt.id = ?`,
      [id]
    );

    if (labTests.length === 0) {
      return res.status(404).json({ message: "Lab test not found" });
    }

    res.json({ labTest: labTests[0] });
  } catch (error) {
    console.error("Get lab test error:", error);
    res.status(500).json({ message: "Failed to fetch lab test" });
  }
});

// Create new lab test (Doctor and Admin only)
router.post(
  "/",
  authenticateToken,
  requireRole(["admin", "doctor"]),
  async (req, res) => {
    try {
      const { patientId, doctorId, testName, testType, normalRanges } =
        req.body;

      // Validate required fields
      if (!patientId || !doctorId || !testName) {
        return res.status(400).json({
          message: "Patient ID, doctor ID, and test name are required",
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

      const labTestId = uuidv4();

      await pool.execute(
        "INSERT INTO lab_tests (id, patient_id, doctor_id, test_name, test_type, normal_ranges) VALUES (?, ?, ?, ?, ?, ?)",
        [
          labTestId,
          patientId,
          doctorId,
          testName,
          testType || null,
          normalRanges || null,
        ]
      );

      // Get the created lab test
      const [newLabTests] = await pool.execute(
        `SELECT lt.*, p.first_name as patient_first_name, p.last_name as patient_last_name,
              d.specialization, u.first_name as doctor_first_name, u.last_name as doctor_last_name
       FROM lab_tests lt
       JOIN patients p ON lt.patient_id = p.id
       JOIN doctors d ON lt.doctor_id = d.id
       JOIN users u ON d.user_id = u.id
       WHERE lt.id = ?`,
        [labTestId]
      );

      res.status(201).json({
        message: "Lab test created successfully",
        labTest: newLabTests[0],
      });
    } catch (error) {
      console.error("Create lab test error:", error);
      res.status(500).json({ message: "Failed to create lab test" });
    }
  }
);

// Update lab test results (Lab and Admin only) - file upload removed
// You may want to add a new endpoint for updating results without file upload if needed

// Update lab test status
router.put(
  "/:id/status",
  authenticateToken,
  requireRole(["admin", "lab"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status, technician } = req.body;

      const validStatuses = ["pending", "processing", "completed", "cancelled"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      // Check if lab test exists
      const [labTests] = await pool.execute(
        "SELECT id FROM lab_tests WHERE id = ?",
        [id]
      );

      if (labTests.length === 0) {
        return res.status(404).json({ message: "Lab test not found" });
      }

      const updates = ["status = ?"];
      const values = [status];

      if (technician) {
        updates.push("technician = ?");
        values.push(technician);
      }

      if (status === "completed") {
        updates.push("completed_at = CURRENT_TIMESTAMP");
      }

      values.push(id);

      await pool.execute(
        `UPDATE lab_tests SET ${updates.join(", ")} WHERE id = ?`,
        values
      );

      res.json({ message: "Lab test status updated successfully" });
    } catch (error) {
      console.error("Update lab test status error:", error);
      res.status(500).json({ message: "Failed to update lab test status" });
    }
  }
);

// Delete lab test (Admin only)
router.delete(
  "/:id",
  authenticateToken,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const { id } = req.params;

      // Check if lab test exists
      const [labTests] = await pool.execute(
        "SELECT id FROM lab_tests WHERE id = ?",
        [id]
      );

      if (labTests.length === 0) {
        return res.status(404).json({ message: "Lab test not found" });
      }

      // Delete lab test
      await pool.execute("DELETE FROM lab_tests WHERE id = ?", [id]);

      res.json({ message: "Lab test deleted successfully" });
    } catch (error) {
      console.error("Delete lab test error:", error);
      res.status(500).json({ message: "Failed to delete lab test" });
    }
  }
);

// Get lab tests by patient
router.get("/patient/:patientId", authenticateToken, async (req, res) => {
  try {
    const { patientId } = req.params;

    const [labTests] = await pool.execute(
      `SELECT lt.*, d.specialization, u.first_name as doctor_first_name, u.last_name as doctor_last_name
       FROM lab_tests lt
       JOIN doctors d ON lt.doctor_id = d.id
       JOIN users u ON d.user_id = u.id
       WHERE lt.patient_id = ?
       ORDER BY lt.created_at DESC`,
      [patientId]
    );

    res.json({ labTests });
  } catch (error) {
    console.error("Get patient lab tests error:", error);
    res.status(500).json({ message: "Failed to fetch patient lab tests" });
  }
});

// Get pending lab tests
router.get(
  "/pending/list",
  authenticateToken,
  requireRole(["admin", "lab"]),
  async (req, res) => {
    try {
      const [labTests] = await pool.execute(
        `SELECT lt.*, p.first_name as patient_first_name, p.last_name as patient_last_name,
              p.email as patient_email, p.phone as patient_phone,
              d.specialization, u.first_name as doctor_first_name, u.last_name as doctor_last_name
       FROM lab_tests lt
       JOIN patients p ON lt.patient_id = p.id
       JOIN doctors d ON lt.doctor_id = d.id
       JOIN users u ON d.user_id = u.id
       WHERE lt.status IN ('pending', 'processing')
       ORDER BY lt.created_at ASC`,
        []
      );

      res.json({ labTests });
    } catch (error) {
      console.error("Get pending lab tests error:", error);
      res.status(500).json({ message: "Failed to fetch pending lab tests" });
    }
  }
);

// Get lab test statistics
router.get("/stats/overview", authenticateToken, async (req, res) => {
  try {
    const [stats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_tests,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_tests,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_tests,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tests,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_tests,
        SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today_tests
      FROM lab_tests
    `);

    res.json({ overview: stats[0] });
  } catch (error) {
    console.error("Get lab test stats error:", error);
    res.status(500).json({ message: "Failed to fetch lab test statistics" });
  }
});

// Get a presigned download URL for a lab test result file
router.get("/:id/result-url", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [labTests] = await pool.execute(
      "SELECT result_file FROM lab_tests WHERE id = ? LIMIT 1",
      [id]
    );

    if (labTests.length === 0) {
      return res.status(404).json({ message: "Lab test not found" });
    }

    const resultKey = labTests[0].result_file;
    if (!resultKey) {
      return res.status(404).json({ message: "No result file available" });
    }

    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: resultKey,
    });

    const expiresIn = 60 * 5; // 5 minutes
    const url = await getSignedUrl(s3Client, command, { expiresIn });

    res.json({ url, expiresIn });
  } catch (error) {
    console.error("Get result URL error:", error);
    res.status(500).json({ message: "Failed to generate result download URL" });
  }
});

module.exports = router;
