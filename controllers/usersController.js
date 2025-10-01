const usersService = require("../services/usersService");

const getAllUsers = async (req, res) => {
  try {
    const { page, limit, search, role } = req.query;
    const result = await usersService.getAllUsers({
      page,
      limit,
      search,
      role,
    });
    res.json(result);
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await usersService.getUserById(id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Failed to fetch user" });
  }
};

const createUser = async (req, res) => {
  try {
    const user = await usersService.createUser(req.body);
    res.status(201).json(user);
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ message: "Failed to create user" });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    await usersService.updateUser(id, req.body);
    res.json({ message: "User updated successfully" });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ message: "Failed to update user" });
  }
};

const updateUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    await usersService.updateUserPassword(id, password);
    res.json({ message: "User password updated successfully" });
  } catch (error) {
    console.error("Update user password error:", error);
    res.status(500).json({ message: "Failed to update user password" });
  }
};

const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await usersService.toggleUserStatus(id, req.user.id);
    if (result.error)
      return res.status(result.status).json({ message: result.error });
    res.json(result);
  } catch (error) {
    console.error("Toggle user status error:", error);
    res.status(500).json({ message: "Failed to toggle user status" });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await usersService.deleteUser(id, req.user.id);
    if (result.error)
      return res.status(result.status).json({ message: result.error });
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ message: "Failed to delete user" });
  }
};

const getUserStats = async (req, res) => {
  try {
    const stats = await usersService.getUserStats();
    res.json({ overview: stats });
  } catch (error) {
    console.error("Get user stats error:", error);
    res.status(500).json({ message: "Failed to fetch user statistics" });
  }
};

const getUsersByRole = async (req, res) => {
  try {
    const { role } = req.params;
    const users = await usersService.getUsersByRole(role);
    res.json({ users });
  } catch (error) {
    console.error("Get users by role error:", error);
    res.status(500).json({ message: "Failed to fetch users by role" });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserPassword,
  toggleUserStatus,
  deleteUser,
  getUserStats,
  getUsersByRole,
};
