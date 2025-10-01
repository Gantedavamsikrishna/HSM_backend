// Patient Service (business logic)
const patientsRepository = require("../repositories/patientsRepository");

module.exports = {
  async getAll({ page, limit, search, gender }) {
    return patientsRepository.getAll({ page, limit, search, gender });
  },
  async getById(id) {
    return patientsRepository.getById(id);
  },
  async create(data) {
    return patientsRepository.create(data);
  },
  async update(id, data) {
    return patientsRepository.update(id, data);
  },
  async remove(id) {
    return patientsRepository.remove(id);
  },
  async getAppointments(id) {
    return patientsRepository.getAppointments(id);
  },
  async getTreatments(id) {
    return patientsRepository.getTreatments(id);
  },
  async getLabTests(id) {
    return patientsRepository.getLabTests(id);
  },
  async getBills(id) {
    return patientsRepository.getBills(id);
  },
};
