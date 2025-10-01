const express = require("express");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const User = require("../models/User");
const usersController = require("../controllers/usersController");
const { authenticateToken, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const role = req.query.role || "";
    const skip = (page - 1) * limit;

    // Build Mongoose query
    let query = {};
    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [
        { first_name: regex },
        { last_name: regex },
        { email: regex },
        { phone: regex },
      ];
    }
    if (role) {
      query.role = role;
    }

    const users = await User.find(query)
      .select(
        "_id email first_name last_name role phone is_active created_at updated_at"
      )
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query);
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
router.get(
  "/:id",
  authenticateToken,
  requireAdmin,
  usersController.getUserById
);

router.post("/", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, phone } = req.body;
    if (!email || !password || !firstName || !lastName || !role) {
      return res
        .status(400)
        .json({ message: "All required fields must be provided" });
    }
    const validRoles = ["admin", "doctor", "reception", "lab"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role specified" });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(409)
        .json({ message: "User with this email already exists" });
    }
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const user = new User({
      email,
      password: hashedPassword,
      first_name: firstName,
      last_name: lastName,
      role,
      phone,
    });
    await user.save();
    // TODO: If role is doctor, create doctor profile in doctors collection
    res.status(201).json({
      message: "User created successfully",
      user: {
        id: user._id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        phone: user.phone,
      },
    });
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
