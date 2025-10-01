const treatmentsRepository = require("../repositories/treatmentsRepository");

const getAllTreatments = async (params) => {
  return await treatmentsRepository.getAllTreatments(params);
};

const getTreatmentById = async (id) => {
  return await treatmentsRepository.getTreatmentById(id);
};

const createTreatment = async (data, user) => {
  return await treatmentsRepository.createTreatment(data, user);
};

const updateTreatment = async (id, data, user) => {
  return await treatmentsRepository.updateTreatment(id, data, user);
};

const deleteTreatment = async (id) => {
  return await treatmentsRepository.deleteTreatment(id);
};

const getTreatmentsByPatient = async (patientId) => {
  return await treatmentsRepository.getTreatmentsByPatient(patientId);
};

const getTreatmentsByDoctor = async (doctorId) => {
  return await treatmentsRepository.getTreatmentsByDoctor(doctorId);
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
