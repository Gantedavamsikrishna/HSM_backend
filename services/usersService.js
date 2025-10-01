const usersRepository = require("../repositories/usersRepository");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

const getAllUsers = async ({
  page = 1,
  limit = 10,
  search = "",
  role = "",
}) => {
  return await usersRepository.getAllUsers({ page, limit, search, role });
};

const getUserById = async (id) => {
  return await usersRepository.getUserById(id);
};

const createUser = async (data) => {
  return await usersRepository.createUser(data);
};

const updateUser = async (id, data) => {
  return await usersRepository.updateUser(id, data);
};

const updateUserPassword = async (id, password) => {
  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  return await usersRepository.updateUserPassword(id, hashedPassword);
};

const toggleUserStatus = async (id, currentUserId) => {
  return await usersRepository.toggleUserStatus(id, currentUserId);
};

const deleteUser = async (id, currentUserId) => {
  return await usersRepository.deleteUser(id, currentUserId);
};

const getUserStats = async () => {
  return await usersRepository.getUserStats();
};

const getUsersByRole = async (role) => {
  return await usersRepository.getUsersByRole(role);
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
