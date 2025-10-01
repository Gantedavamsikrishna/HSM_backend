// appointmentsController.js
// Controller for appointments module (MongoDB/Mongoose version)
const appointmentsService = require("../services/appointmentsService");

module.exports = {
  async getAll(req, res) {
    try {
      const result = await appointmentsService.getAll(req.query, req.user);
      res.json(result);
    } catch (error) {
      res
        .status(500)
        .json({
          message: "Failed to fetch appointments",
          error: error.message,
        });
    }
  },

  async getById(req, res) {
    try {
      const appointment = await appointmentsService.getById(req.params.id);
      if (!appointment)
        return res.status(404).json({ message: "Appointment not found" });
      res.json({ appointment });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Failed to fetch appointment", error: error.message });
    }
  },

  async create(req, res) {
    try {
      const appointment = await appointmentsService.create(req.body);
      res.status(201).json({ message: "Appointment created", appointment });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async update(req, res) {
    try {
      const appointment = await appointmentsService.update(
        req.params.id,
        req.body
      );
      res.json({ message: "Appointment updated", appointment });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async remove(req, res) {
    try {
      await appointmentsService.remove(req.params.id);
      res.json({ message: "Appointment deleted" });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },
};
