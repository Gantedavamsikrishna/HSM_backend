const mongoose = require("mongoose");
require("dotenv").config();

const testConnection = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(" MongoDB connected successfully");
    return true;
  } catch (error) {
    console.error(" MongoDB connection failed:", error.message);
    return false;
  }
};

module.exports = {
  testConnection,
  mongoose,
};
