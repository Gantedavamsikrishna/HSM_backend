const doctorsService = require("../services/doctorsService");

const getAllDoctors = async (req, res) => {
  try {
    const { page, limit, search, specialization } = req.query;
    const result = await doctorsService.getAllDoctors({
      page,
      limit,
      search,
      specialization,
    });
    res.json(result);
  } catch (error) {
    console.error("Get doctors error:", error);
    res.status(500).json({ message: "Failed to fetch doctors" });
  }
};

const getDoctorById = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = await doctorsService.getDoctorById(id);
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });
    res.json({ doctor });
  } catch (error) {
    console.error("Get doctor error:", error);
    res.status(500).json({ message: "Failed to fetch doctor" });
  }
};

const createDoctor = async (req, res) => {
  try {
    const doctor = await doctorsService.createDoctor(req.body);
    res.status(201).json(doctor);
  } catch (error) {
    console.error("Create doctor error:", error);
    res.status(500).json({ message: "Failed to create doctor" });
  }
};

const updateDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    await doctorsService.updateDoctor(id, req.body);
    res.json({ message: "Doctor updated successfully" });
  } catch (error) {
    console.error("Update doctor error:", error);
    res.status(500).json({ message: "Failed to update doctor" });
  }
};

const deleteDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    await doctorsService.deleteDoctor(id);
    res.json({ message: "Doctor deleted successfully" });
  } catch (error) {
    console.error("Delete doctor error:", error);
    res.status(500).json({ message: "Failed to delete doctor" });
  }
};

module.exports = {
  getAllDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
};
