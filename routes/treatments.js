const express = require("express");
const treatmentsController = require("../controllers/treatmentsController");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();

// Get all treatments (with pagination and filters)
router.get("/", authenticateToken, treatmentsController.getAllTreatments);

// Get single treatment by ID
router.get("/:id", authenticateToken, treatmentsController.getTreatmentById);

// Create new treatment (Doctor and Admin only)
router.post(
  "/",
  authenticateToken,
  requireRole(["admin", "doctor"]),
  treatmentsController.createTreatment
);

// Update treatment (Doctor and Admin only)
router.put(
  "/:id",
  authenticateToken,
  requireRole(["admin", "doctor"]),
  treatmentsController.updateTreatment
);

// Delete treatment (Admin only)
router.delete(
  "/:id",
  authenticateToken,
  requireRole(["admin"]),
  treatmentsController.deleteTreatment
);

// Get treatments by patient
router.get(
  "/patient/:patientId",
  authenticateToken,
  treatmentsController.getTreatmentsByPatient
);

// Get treatments by doctor
router.get(
  "/doctor/:doctorId",
  authenticateToken,
  treatmentsController.getTreatmentsByDoctor
);

module.exports = router;
