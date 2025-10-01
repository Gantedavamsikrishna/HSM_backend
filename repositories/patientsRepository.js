// Patient Repository (DB access)
const { v4: uuidv4 } = require("uuid");
const { pool } = require("../config/database");

module.exports = {
  async getAll({ page = 1, limit = 10, search = "", gender = "" }) {
    const offset = (page - 1) * limit;
    let query = `SELECT id, first_name, last_name, email, phone, date_of_birth, gender, address, emergency_contact, emergency_phone, medical_history, allergies, blood_group, created_at, updated_at FROM patients WHERE 1=1`;
    let params = [];
    let paramIdx = 1;
    if (search) {
      query += ` AND (first_name ILIKE $${paramIdx} OR last_name ILIKE $${
        paramIdx + 1
      } OR email ILIKE $${paramIdx + 2} OR phone ILIKE $${paramIdx + 3})`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      paramIdx += 4;
    }
    if (gender) {
      query += ` AND gender = $${paramIdx}`;
      params.push(gender);
      paramIdx++;
    }
    query += ` ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${
      paramIdx + 1
    }`;
    params.push(limit, offset);
    const { rows: patients } = await pool.query(query, params);
    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) as total FROM patients WHERE 1=1`;
    let countParams = [];
    let countIdx = 1;
    if (search) {
      countQuery += ` AND (first_name ILIKE $${countIdx} OR last_name ILIKE $${
        countIdx + 1
      } OR email ILIKE $${countIdx + 2} OR phone ILIKE $${countIdx + 3})`;
      const searchPattern = `%${search}%`;
      countParams.push(
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern
      );
      countIdx += 4;
    }
    if (gender) {
      countQuery += ` AND gender = $${countIdx}`;
      countParams.push(gender);
      countIdx++;
    }
    const { rows: countResult } = await pool.query(countQuery, countParams);
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);
    return {
      patients,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  },

  async getById(id) {
    const { rows } = await pool.query(
      `SELECT id, first_name, last_name, email, phone, date_of_birth, gender, address, emergency_contact, emergency_phone, medical_history, allergies, blood_group, created_at, updated_at FROM patients WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async create(data) {
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
    } = data;
    const patientId = uuidv4();
    await pool.query(
      `INSERT INTO patients (id, first_name, last_name, email, phone, date_of_birth, gender, address, emergency_contact, emergency_phone, medical_history, allergies, blood_group) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
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
    const { rows: newPatients } = await pool.query(
      "SELECT * FROM patients WHERE id = $1",
      [patientId]
    );
    return newPatients[0];
  },

  async update(id, data) {
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
    } = data;
    await pool.query(
      `UPDATE patients SET first_name = $1, last_name = $2, email = $3, phone = $4, date_of_birth = $5, gender = $6, address = $7, emergency_contact = $8, emergency_phone = $9, medical_history = $10, allergies = $11, blood_group = $12, updated_at = CURRENT_TIMESTAMP WHERE id = $13`,
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
  },

  async remove(id) {
    await pool.query("DELETE FROM patients WHERE id = $1", [id]);
  },

  async getAppointments(id) {
    const { rows: appointments } = await pool.query(
      `SELECT a.id, a.date_time, a.status, a.reason, a.notes, a.created_at, d.specialization, u.first_name as doctor_first_name, u.last_name as doctor_last_name FROM appointments a JOIN doctors d ON a.doctor_id = d.id JOIN users u ON d.user_id = u.id WHERE a.patient_id = $1 ORDER BY a.date_time DESC`,
      [id]
    );
    return appointments;
  },

  async getTreatments(id) {
    const { rows: treatments } = await pool.query(
      `SELECT t.id, t.diagnosis, t.prescription, t.notes, t.follow_up_date, t.created_at, d.specialization, u.first_name as doctor_first_name, u.last_name as doctor_last_name FROM treatments t JOIN doctors d ON t.doctor_id = d.id JOIN users u ON d.user_id = u.id WHERE t.patient_id = $1 ORDER BY t.created_at DESC`,
      [id]
    );
    return treatments;
  },

  async getLabTests(id) {
    const { rows: labTests } = await pool.query(
      `SELECT lt.id, lt.test_name, lt.test_type, lt.status, lt.results, lt.result_file, lt.normal_ranges, lt.technician, lt.completed_at, lt.created_at, d.specialization, u.first_name as doctor_first_name, u.last_name as doctor_last_name FROM lab_tests lt JOIN doctors d ON lt.doctor_id = d.id JOIN users u ON d.user_id = u.id WHERE lt.patient_id = $1 ORDER BY lt.created_at DESC`,
      [id]
    );
    return labTests;
  },

  async getBills(id) {
    const { rows: bills } = await pool.query(
      `SELECT b.id, b.total_amount, b.paid_amount, b.status, b.payment_method, b.notes, b.created_at, d.specialization, u.first_name as doctor_first_name, u.last_name as doctor_last_name FROM bills b LEFT JOIN doctors d ON b.doctor_id = d.id LEFT JOIN users u ON d.user_id = u.id WHERE b.patient_id = $1 ORDER BY b.created_at DESC`,
      [id]
    );
    for (let bill of bills) {
      const { rows: items } = await pool.query(
        "SELECT * FROM bill_items WHERE bill_id = $1",
        [bill.id]
      );
      bill.items = items;
    }
    return bills;
  },
};
