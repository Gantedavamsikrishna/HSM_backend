// labTestsRepository.js
// Repository for lab tests module (MongoDB/Mongoose version)
// NOTE: You must create the LabTest model in ../models/LabTest.js
const LabTest = require("../models/LabTest");

module.exports = {
  async getAll(query) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const search = query.search || "";
    const status = query.status || "";
    const doctorId = query.doctor_id || "";
    const patientId = query.patient_id || "";
    const filter = {};
    if (search) {
      filter.$or = [
        { test_name: { $regex: search, $options: "i" } },
        { test_type: { $regex: search, $options: "i" } },
      ];
    }
    if (status) filter.status = status;
    if (doctorId) filter.doctor_id = doctorId;
    if (patientId) filter.patient_id = patientId;
    const total = await LabTest.countDocuments(filter);
    const labTests = await LabTest.find(filter)
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("patient_id")
      .populate("doctor_id")
      .lean();
    const totalPages = Math.ceil(total / limit);
    return {
      labTests,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  },
  async getById(id) {
    return await LabTest.findById(id)
      .populate("patient_id")
      .populate("doctor_id")
      .lean();
  },
  async create(data) {
    const labTest = new LabTest(data);
    await labTest.save();
    return labTest;
  },
  async update(id, data) {
    return await LabTest.findByIdAndUpdate(id, data, { new: true }).lean();
  },
  async remove(id) {
    await LabTest.findByIdAndDelete(id);
  },
};
