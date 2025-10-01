const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const { testConnection } = require("./config/database");

const insertDefaultUsers = require("./insertDefaultUsers");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/patients", require("./routes/patients"));
app.use("/api/bills", require("./routes/bills"));
app.use("/api/appointments", require("./routes/appointments"));
app.use("/api/treatments", require("./routes/treatments"));
app.use("/api/lab-tests", require("./routes/labTests"));
app.use("/api/users", require("./routes/users"));
app.use("/api/dashboard", require("./routes/dashboard"));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Something went wrong!",
    error:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal Server Error",
  });
});

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

const startServer = async () => {
  try {
    const isConnected = await testConnection();
    if (!isConnected) {
      console.error(
        " Failed to connect to database. Please check your database configuration."
      );
      process.exit(1);
    }

    // Database schema initialization should be handled by migrations or manually.

    // Insert default users if DB is empty
    await insertDefaultUsers();
    // Start server
    app.listen(PORT, () => {
      console.log(` Server running on port ${PORT}`);
      console.log(` Hospital Management System API ready!`);
    });
  } catch (error) {
    console.error(" Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
