// labTestsController.js
// Controller for lab tests module (MongoDB/Mongoose version)
const labTestsService = require("../services/labTestsService");

module.exports = {
  async getAll(req, res) {
    try {
      const result = await labTestsService.getAll(req.query);
      res.json(result);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Failed to fetch lab tests", error: error.message });
    }
  },

  async getById(req, res) {
    try {
      const labTest = await labTestsService.getById(req.params.id);
      if (!labTest)
        return res.status(404).json({ message: "Lab test not found" });
      res.json({ labTest });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Failed to fetch lab test", error: error.message });
    }
  },

  async create(req, res) {
    try {
      const labTest = await labTestsService.create(req.body);
      res.status(201).json({ message: "Lab test created", labTest });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async update(req, res) {
    try {
      const labTest = await labTestsService.update(req.params.id, req.body);
      res.json({ message: "Lab test updated", labTest });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async remove(req, res) {
    try {
      await labTestsService.remove(req.params.id);
      res.json({ message: "Lab test deleted" });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },
};
