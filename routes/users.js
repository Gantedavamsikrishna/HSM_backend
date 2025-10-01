const express = require("express");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { pool } = require("../config/database");
const { authenticateToken, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Get all users (Admin only)
router.get("/", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const role = req.query.role || "";
    const offset = (page - 1) * limit;

    let query = `
      SELECT id, email, first_name, last_name, role, phone, is_active, created_at, updated_at
      FROM users
      WHERE 1=1
    `;
    let params = [];

    // Add search filter
    if (search) {
      query += ` AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // Add role filter
    if (role) {
      query += ` AND role = ?`;
      params.push(role);
    }

    // Add ordering and pagination (inline limit/offset to avoid MySQL argument error)
    query += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    const [users] = await pool.execute(query, params);

    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) as total FROM users WHERE 1=1`;
    let countParams = [];

    if (search) {
      countQuery += ` AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ?)`;
      const searchPattern = `%${search}%`;
      countParams.push(
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern
      );
    }

    if (role) {
      countQuery += ` AND role = ?`;
      countParams.push(role);
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    res.json({
      users,
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
    console.error("Get users error:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// Get single user by ID (Admin only)
router.get("/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const [users] = await pool.execute(
      "SELECT id, email, first_name, last_name, role, phone, is_active, created_at, updated_at FROM users WHERE id = ?",
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = users[0];

    // Get additional doctor info if user is a doctor
    if (user.role === "doctor") {
      const [doctors] = await pool.execute(
        "SELECT specialization, license_number, experience, consultation_fee FROM doctors WHERE user_id = ?",
        [id]
      );

      if (doctors.length > 0) {
        user.doctorInfo = doctors[0];
      }
    }

    res.json({ user });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

// Create new user (Admin only)
router.post("/", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, phone } = req.body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !role) {
      return res
        .status(400)
        .json({ message: "All required fields must be provided" });
    }

    // Validate role
    const validRoles = ["admin", "doctor", "reception", "lab"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role specified" });
    }

    // Check if user already exists
    const [existingUsers] = await pool.execute(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (existingUsers.length > 0) {
      return res
        .status(409)
        .json({ message: "User with this email already exists" });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const userId = uuidv4();

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      await connection.execute(
        "INSERT INTO users (id, email, password, first_name, last_name, role, phone) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          userId,
          email,
          hashedPassword,
          firstName,
          lastName,
          role,
          phone || null,
        ]
      );

      // If role is doctor, create doctor profile
      if (role === "doctor") {
        const doctorId = uuidv4();
        await connection.execute(
          "INSERT INTO doctors (id, user_id, specialization, license_number, experience, consultation_fee) VALUES (?, ?, ?, ?, ?, ?)",
          [doctorId, userId, "General Medicine", "", 0, 100]
        );
      }

      await connection.commit();

      res.status(201).json({
        message: "User created successfully",
        user: {
          id: userId,
          email,
          firstName,
          lastName,
          role,
          phone,
        },
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ message: "Failed to create user" });
  }
});

// Update user (Admin only)
router.put("/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, phone, role, isActive } = req.body;

    // Check if user exists
    const [existingUsers] = await pool.execute(
      "SELECT id, role FROM users WHERE id = ?",
      [id]
    );

    if (existingUsers.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Validate role if provided
    if (role) {
      const validRoles = ["admin", "doctor", "reception", "lab"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role specified" });
      }
    }

    // Check if email is being changed and if it conflicts
    if (email) {
      const [emailConflict] = await pool.execute(
        "SELECT id FROM users WHERE email = ? AND id != ?",
        [email, id]
      );

      if (emailConflict.length > 0) {
        return res
          .status(409)
          .json({ message: "User with this email already exists" });
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (firstName) {
      updates.push("first_name = ?");
      values.push(firstName);
    }
    if (lastName) {
      updates.push("last_name = ?");
      values.push(lastName);
    }
    if (email) {
      updates.push("email = ?");
      values.push(email);
    }
    if (phone !== undefined) {
      updates.push("phone = ?");
      values.push(phone);
    }
    if (role) {
      updates.push("role = ?");
      values.push(role);
    }
    if (isActive !== undefined) {
      updates.push("is_active = ?");
      values.push(isActive);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    values.push(id);

    await pool.execute(
      `UPDATE users SET ${updates.join(
        ", "
      )}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );

    res.json({ message: "User updated successfully" });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ message: "Failed to update user" });
  }
});

// Update user password (Admin only)
router.put(
  "/:id/password",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({ message: "Password is required" });
      }

      // Check if user exists
      const [users] = await pool.execute("SELECT id FROM users WHERE id = ?", [
        id,
      ]);

      if (users.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      // Hash new password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Update password
      await pool.execute(
        "UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [hashedPassword, id]
      );

      res.json({ message: "User password updated successfully" });
    } catch (error) {
      console.error("Update user password error:", error);
      res.status(500).json({ message: "Failed to update user password" });
    }
  }
);

// Toggle user active status (Admin only)
router.put(
  "/:id/toggle-status",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Check if user exists
      const [users] = await pool.execute(
        "SELECT id, is_active FROM users WHERE id = ?",
        [id]
      );

      if (users.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      const newStatus = !users[0].is_active;

      await pool.execute(
        "UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [newStatus, id]
      );

      res.json({
        message: `User ${newStatus ? "activated" : "deactivated"} successfully`,
        isActive: newStatus,
      });
    } catch (error) {
      console.error("Toggle user status error:", error);
      res.status(500).json({ message: "Failed to toggle user status" });
    }
  }
);

// Delete user (Admin only)
router.delete("/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const [users] = await pool.execute("SELECT id FROM users WHERE id = ?", [
      id,
    ]);

    if (users.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent admin from deleting themselves
    if (id === req.user.id) {
      return res
        .status(400)
        .json({ message: "Cannot delete your own account" });
    }

    // Delete user (cascade will handle related records)
    await pool.execute("DELETE FROM users WHERE id = ?", [id]);

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ message: "Failed to delete user" });
  }
});

// Get user statistics
router.get(
  "/stats/overview",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const [stats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admin_users,
        SUM(CASE WHEN role = 'doctor' THEN 1 ELSE 0 END) as doctor_users,
        SUM(CASE WHEN role = 'reception' THEN 1 ELSE 0 END) as reception_users,
        SUM(CASE WHEN role = 'lab' THEN 1 ELSE 0 END) as lab_users,
        SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active_users,
        SUM(CASE WHEN is_active = false THEN 1 ELSE 0 END) as inactive_users,
        SUM(CASE WHEN DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as new_users_30_days
      FROM users
    `);

      res.json({ overview: stats[0] });
    } catch (error) {
      console.error("Get user stats error:", error);
      res.status(500).json({ message: "Failed to fetch user statistics" });
    }
  }
);

// Get users by role
router.get("/role/:role", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { role } = req.params;

    const validRoles = ["admin", "doctor", "reception", "lab"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role specified" });
    }

    const [users] = await pool.execute(
      "SELECT id, email, first_name, last_name, role, phone, is_active, created_at FROM users WHERE role = ? ORDER BY first_name, last_name",
      [role]
    );

    // Get additional doctor info for doctor role
    if (role === "doctor") {
      for (let user of users) {
        const [doctors] = await pool.execute(
          "SELECT specialization, license_number, experience, consultation_fee FROM doctors WHERE user_id = ?",
          [user.id]
        );

        if (doctors.length > 0) {
          user.doctorInfo = doctors[0];
        }
      }
    }

    res.json({ users });
  } catch (error) {
    console.error("Get users by role error:", error);
    res.status(500).json({ message: "Failed to fetch users by role" });
  }
});

module.exports = router;
