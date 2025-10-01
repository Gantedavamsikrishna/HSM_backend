// Patient Controller (handles HTTP logic)
const patientsService = require("../services/patientsService");

module.exports = {
  async getAll(req, res) {
    try {
      const { page, limit, search, gender } = req.query;
      const result = await patientsService.getAll({
        page,
        limit,
        search,
        gender,
      });
      res.json(result);
    } catch (error) {
      console.error("Get patients error:", error);
      res.status(500).json({ message: "Failed to fetch patients" });
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params;
      const patient = await patientsService.getById(id);
      if (!patient)
        return res.status(404).json({ message: "Patient not found" });
      res.json({ patient });
    } catch (error) {
      console.error("Get patient error:", error);
      res.status(500).json({ message: "Failed to fetch patient" });
    }
  },

  async create(req, res) {
    try {
      const patient = await patientsService.create(req.body);
      res
        .status(201)
        .json({ message: "Patient created successfully", patient });
    } catch (error) {
      console.error("Create patient error:", error);
      res.status(500).json({ message: "Failed to create patient" });
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params;
      await patientsService.update(id, req.body);
      res.json({ message: "Patient updated successfully" });
    } catch (error) {
      console.error("Update patient error:", error);
      res.status(500).json({ message: "Failed to update patient" });
    }
  },

  async remove(req, res) {
    try {
      const { id } = req.params;
      await patientsService.remove(id);
      res.json({ message: "Patient deleted successfully" });
    } catch (error) {
      console.error("Delete patient error:", error);
      res.status(500).json({ message: "Failed to delete patient" });
    }
  },

  async getAppointments(req, res) {
    try {
      const { id } = req.params;
      const appointments = await patientsService.getAppointments(id);
      res.json({ appointments });
    } catch (error) {
      console.error("Get patient appointments error:", error);
      res.status(500).json({ message: "Failed to fetch patient appointments" });
    }
  },

  async getTreatments(req, res) {
    try {
      const { id } = req.params;
      const treatments = await patientsService.getTreatments(id);
      res.json({ treatments });
    } catch (error) {
      console.error("Get patient treatments error:", error);
      res.status(500).json({ message: "Failed to fetch patient treatments" });
    }
  },

  async getLabTests(req, res) {
    try {
      const { id } = req.params;
      const labTests = await patientsService.getLabTests(id);
      res.json({ labTests });
    } catch (error) {
      console.error("Get patient lab tests error:", error);
      res.status(500).json({ message: "Failed to fetch patient lab tests" });
    }
  },

  async getBills(req, res) {
    try {
      const { id } = req.params;
      const bills = await patientsService.getBills(id);
      res.json({ bills });
    } catch (error) {
      console.error("Get patient bills error:", error);
      res.status(500).json({ message: "Failed to fetch patient bills" });
    }
  },
};
