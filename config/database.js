const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "hospital_management",
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
  max: 10,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 60000,
  ssl: {
    require: true,
    rejectUnauthorized: false,
  },
});

const testConnection = async () => {
  try {
    await pool.query("SELECT 1");
    console.log(" Database connected successfully");
    return true;
  } catch (error) {
    console.error(" Database connection failed:", error.message);
    return false;
  }
};

// Note: Table creation and schema management should be handled via migrations, not in code for production.
// If you want to run initialization, use pool.query with valid PostgreSQL DDL.

module.exports = {
  pool,
  testConnection,
};
