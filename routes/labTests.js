const express = require("express");
const { authenticateToken, requireRole } = require("../middleware/auth");
const labTestsController = require("../controllers/labTestsController");

const router = express.Router();

// Get all lab tests
router.get("/", authenticateToken, labTestsController.getAll);

// Get single lab test by ID
router.get("/:id", authenticateToken, labTestsController.getById);

// Create new lab test (Lab and Admin only)
router.post(
  "/",
  authenticateToken,
  requireRole(["admin", "lab"]),
  labTestsController.create
);

// Update lab test (Lab and Admin only)
router.put(
  "/:id",
  authenticateToken,
  requireRole(["admin", "lab"]),
  labTestsController.update
);

// Delete lab test (Admin only)
router.delete(
  "/:id",
  authenticateToken,
  requireRole(["admin"]),
  labTestsController.remove
);

module.exports = router;
