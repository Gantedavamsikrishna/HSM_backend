const treatmentsService = require("../services/treatmentsService");

const getAllTreatments = async (req, res) => {
  try {
    const { page, limit, search, doctor_id, patient_id } = req.query;
    const result = await treatmentsService.getAllTreatments({
      page,
      limit,
      search,
      doctor_id,
      patient_id,
      user: req.user,
    });
    res.json(result);
  } catch (error) {
    console.error("Get treatments error:", error);
    res.status(500).json({ message: "Failed to fetch treatments" });
  }
};

const getTreatmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const treatment = await treatmentsService.getTreatmentById(id);
    if (!treatment)
      return res.status(404).json({ message: "Treatment not found" });
    res.json({ treatment });
  } catch (error) {
    console.error("Get treatment error:", error);
    res.status(500).json({ message: "Failed to fetch treatment" });
  }
};

const createTreatment = async (req, res) => {
  try {
    const treatment = await treatmentsService.createTreatment(
      req.body,
      req.user
    );
    res.status(201).json(treatment);
  } catch (error) {
    console.error("Create treatment error:", error);
    res.status(500).json({ message: "Failed to create treatment" });
  }
};

const updateTreatment = async (req, res) => {
  try {
    const { id } = req.params;
    await treatmentsService.updateTreatment(id, req.body, req.user);
    res.json({ message: "Treatment updated successfully" });
  } catch (error) {
    console.error("Update treatment error:", error);
    res.status(500).json({ message: "Failed to update treatment" });
  }
};

const deleteTreatment = async (req, res) => {
  try {
    const { id } = req.params;
    await treatmentsService.deleteTreatment(id);
    res.json({ message: "Treatment deleted successfully" });
  } catch (error) {
    console.error("Delete treatment error:", error);
    res.status(500).json({ message: "Failed to delete treatment" });
  }
};

const getTreatmentsByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const treatments = await treatmentsService.getTreatmentsByPatient(
      patientId
    );
    res.json({ treatments });
  } catch (error) {
    console.error("Get patient treatments error:", error);
    res.status(500).json({ message: "Failed to fetch patient treatments" });
  }
};

const getTreatmentsByDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const treatments = await treatmentsService.getTreatmentsByDoctor(doctorId);
    res.json({ treatments });
  } catch (error) {
    console.error("Get doctor treatments error:", error);
    res.status(500).json({ message: "Failed to fetch doctor treatments" });
  }
};

module.exports = {
  getAllTreatments,
  getTreatmentById,
  createTreatment,
  updateTreatment,
  deleteTreatment,
  getTreatmentsByPatient,
  getTreatmentsByDoctor,
};
