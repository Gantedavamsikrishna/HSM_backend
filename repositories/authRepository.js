// authRepository.js
// Repository for authentication (MongoDB/Mongoose version)
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

module.exports = {
  async register(data) {
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
      id: user._id,
      email,
      firstName,
      lastName,
      role,
      phone,
    };
  },

  async login(data) {
    const { email, password } = data;
    const user = await User.findOne({ email });
    if (!user) throw new Error("Invalid email or password");
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new Error("Invalid email or password");
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "1d" }
    );
    return {
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        phone: user.phone,
      },
    };
  },

  async getMe(id) {
    const user = await User.findById(id).lean();
    if (!user) throw new Error("User not found");
    return {
      id: user._id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      phone: user.phone,
    };
  },

  async updateProfile(user, data) {
    // Update user profile fields
    const {
      firstName,
      lastName,
      phone,
      specialization,
      licenseNumber,
      experience,
      consultationFee,
    } = data;
    const dbUser = await User.findById(user.id);
    if (!dbUser) throw new Error("User not found");
    if (firstName) dbUser.first_name = firstName;
    if (lastName) dbUser.last_name = lastName;
    if (phone !== undefined) dbUser.phone = phone;
    dbUser.updated_at = new Date();
    await dbUser.save();
    // If doctor, update doctor info (stub: implement if Doctor model exists)
    // if (user.role === 'doctor' && specialization) { ... }
    return { message: "Profile updated successfully" };
  },

  async changePassword(userId, currentPassword, newPassword) {
    if (!currentPassword || !newPassword) {
      throw new Error("Current and new passwords are required");
    }
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) throw new Error("Current password is incorrect");
    const saltRounds = 12;
    user.password = await bcrypt.hash(newPassword, saltRounds);
    user.updated_at = new Date();
    await user.save();
    return { message: "Password changed successfully" };
  },
};
