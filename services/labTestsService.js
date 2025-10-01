// labTestsService.js
// Service for lab tests module (MongoDB/Mongoose version)
const labTestsRepository = require("../repositories/labTestsRepository");

module.exports = {
  async getAll(query) {
    return await labTestsRepository.getAll(query);
  },
  async getById(id) {
    return await labTestsRepository.getById(id);
  },
  async create(data) {
    return await labTestsRepository.create(data);
  },
  async update(id, data) {
    return await labTestsRepository.update(id, data);
  },
  async remove(id) {
    await labTestsRepository.remove(id);
  },
};
