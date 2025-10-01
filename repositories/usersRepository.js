const User = require("../models/User");
const bcrypt = require("bcryptjs");

const getAllUsers = async ({
  page = 1,
  limit = 10,
  search = "",
  role = "",
}) => {
  const filter = {};
  if (search) {
    filter.$or = [
      { first_name: { $regex: search, $options: "i" } },
      { last_name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
    ];
  }
  if (role) {
    filter.role = role;
  }
  const total = await User.countDocuments(filter);
  const users = await User.find(filter)
    .sort({ created_at: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  const totalPages = Math.ceil(total / limit);
  return {
    users,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems: total,
      itemsPerPage: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
};

const getUserById = async (id) => {
  return await User.findById(id).lean();
};

const createUser = async (data) => {
  const { email, password, firstName, lastName, role, phone } = data;
  if (!email || !password || !firstName || !lastName || !role) {
    throw new Error("All required fields must be provided");
  }
  const validRoles = ["admin", "doctor", "reception", "lab"];
  if (!validRoles.includes(role)) {
    throw new Error("Invalid role specified");
  }
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new Error("User with this email already exists");
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
  return {
    message: "User created successfully",
    user: {
      id: user._id,
      email,
      firstName,
      lastName,
      role,
      phone,
    },
  };
};

const updateUser = async (id, data) => {
  const { firstName, lastName, email, phone, role, isActive } = data;
  const user = await User.findById(id);
  if (!user) throw new Error("User not found");
  if (role) {
    const validRoles = ["admin", "doctor", "reception", "lab"];
    if (!validRoles.includes(role)) {
      throw new Error("Invalid role specified");
    }
    user.role = role;
  }
  if (email && email !== user.email) {
    const emailConflict = await User.findOne({ email, _id: { $ne: id } });
    if (emailConflict) throw new Error("User with this email already exists");
    user.email = email;
  }
  if (firstName) user.first_name = firstName;
  if (lastName) user.last_name = lastName;
  if (phone !== undefined) user.phone = phone;
  if (isActive !== undefined) user.is_active = isActive;
  user.updated_at = new Date();
  await user.save();
};

const updateUserPassword = async (id, password) => {
  const user = await User.findById(id);
  if (!user) throw new Error("User not found");
  const saltRounds = 12;
  user.password = await bcrypt.hash(password, saltRounds);
  user.updated_at = new Date();
  await user.save();
};

const toggleUserStatus = async (id, currentUserId) => {
  if (id === currentUserId) {
    return { error: "Cannot change your own status", status: 400 };
  }
  const user = await User.findById(id);
  if (!user) return { error: "User not found", status: 404 };
  user.is_active = !user.is_active;
  user.updated_at = new Date();
  await user.save();
  return {
    message: `User ${
      user.is_active ? "activated" : "deactivated"
    } successfully`,
    isActive: user.is_active,
  };
};

const deleteUser = async (id, currentUserId) => {
  if (id === currentUserId) {
    return { error: "Cannot delete your own account", status: 400 };
  }
  const user = await User.findById(id);
  if (!user) return { error: "User not found", status: 404 };
  await User.deleteOne({ _id: id });
  return {};
};

const getUserStats = async () => {
  const total = await User.countDocuments();
  const admin_users = await User.countDocuments({ role: "admin" });
  const doctor_users = await User.countDocuments({ role: "doctor" });
  const reception_users = await User.countDocuments({ role: "reception" });
  const lab_users = await User.countDocuments({ role: "lab" });
  const active_users = await User.countDocuments({ is_active: true });
  const inactive_users = await User.countDocuments({ is_active: false });
  const new_users_30_days = await User.countDocuments({
    created_at: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
  });
  return {
    total_users: total,
    admin_users,
    doctor_users,
    reception_users,
    lab_users,
    active_users,
    inactive_users,
    new_users_30_days,
  };
};

const getUsersByRole = async (role) => {
  const validRoles = ["admin", "doctor", "reception", "lab"];
  if (!validRoles.includes(role)) {
    throw new Error("Invalid role specified");
  }
  const users = await User.find({ role })
    .sort({ first_name: 1, last_name: 1 })
    .lean();
  return users;
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
