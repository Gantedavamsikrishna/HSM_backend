const express = require("express");
const doctorsController = require("../controllers/doctorsController");
const { authenticateToken, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Get all doctors
router.get("/", authenticateToken, doctorsController.getAllDoctors);

// Get doctor by ID
router.get("/:id", authenticateToken, doctorsController.getDoctorById);

// Create new doctor (Admin only)
router.post(
  "/",
  authenticateToken,
  requireAdmin,
  doctorsController.createDoctor
);

// Update doctor (Admin only)
router.put(
  "/:id",
  authenticateToken,
  requireAdmin,
  doctorsController.updateDoctor
);

// Delete doctor (Admin only)
router.delete(
  "/:id",
  authenticateToken,
  requireAdmin,
  doctorsController.deleteDoctor
);

module.exports = router;
