const doctorsRepository = require("../repositories/doctorsRepository");

const getAllDoctors = async (params) => {
  return await doctorsRepository.getAllDoctors(params);
};

const getDoctorById = async (id) => {
  return await doctorsRepository.getDoctorById(id);
};

const createDoctor = async (data) => {
  return await doctorsRepository.createDoctor(data);
};

const updateDoctor = async (id, data) => {
  return await doctorsRepository.updateDoctor(id, data);
};

const deleteDoctor = async (id) => {
  return await doctorsRepository.deleteDoctor(id);
};

module.exports = {
  getAllDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
};
