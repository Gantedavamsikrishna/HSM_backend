// appointmentsService.js
// Service for appointments module (MongoDB/Mongoose version)
const appointmentsRepository = require("../repositories/appointmentsRepository");

module.exports = {
  async getAll(query, user) {
    return await appointmentsRepository.getAll(query, user);
  },
  async getById(id) {
    return await appointmentsRepository.getById(id);
  },
  async create(data) {
    return await appointmentsRepository.create(data);
  },
  async update(id, data) {
    return await appointmentsRepository.update(id, data);
  },
  async remove(id) {
    return await appointmentsRepository.remove(id);
  },
};
