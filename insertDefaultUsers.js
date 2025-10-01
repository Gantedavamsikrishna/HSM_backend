// This script inserts default users for all roles into MongoDB on server start if no users exist.
const bcrypt = require("bcryptjs");
const User = require("./models/User");

async function insertDefaultUsers() {
  const count = await User.countDocuments();
  if (count > 0) {
    console.log("Users already exist. Skipping default user creation.");
    return;
  }
  const users = [
    {
      email: "admin@example.com",
      password: "admin123",
      first_name: "Admin",
      last_name: "User",
      role: "admin",
      phone: "1111111111",
    },
    {
      email: "doctor@example.com",
      password: "doctor123",
      first_name: "Doctor",
      last_name: "User",
      role: "doctor",
      phone: "2222222222",
    },
    {
      email: "reception@example.com",
      password: "reception123",
      first_name: "Reception",
      last_name: "User",
      role: "reception",
      phone: "3333333333",
    },
    {
      email: "lab@example.com",
      password: "lab123",
      first_name: "Lab",
      last_name: "User",
      role: "lab",
      phone: "4444444444",
    },
  ];
  for (const user of users) {
    const hash = await bcrypt.hash(user.password, 10);
    await User.create({
      email: user.email,
      password: hash,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      phone: user.phone,
      is_active: true,
    });
  }
  console.log("Default users created: admin, doctor, reception, lab");
}

module.exports = insertDefaultUsers;
