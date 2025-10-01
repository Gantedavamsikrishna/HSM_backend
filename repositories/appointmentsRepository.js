// appointmentsRepository.js
// Repository for appointments module (MongoDB/Mongoose version)
// NOTE: You must create the Appointment model in ../models/Appointment.js
const Appointment = require("../models/Appointment");
const Patient = require("../models/Patient");
const Doctor = require("../models/Doctor");

module.exports = {
  async getAll(query, user) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const search = query.search || "";
    const status = query.status || "";
    const doctorId = query.doctor_id || "";
    const date = query.date || "";
    const filter = {};
    if (search) {
      filter.$or = [
        { reason: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } },
      ];
    }
    if (status) filter.status = status;
    if (doctorId) filter.doctor_id = doctorId;
    if (date)
      filter.date_time = {
        $gte: new Date(date + "T00:00:00Z"),
        $lte: new Date(date + "T23:59:59Z"),
      };
    if (user.role === "doctor") filter.doctor_id = user.id;
    const total = await Appointment.countDocuments(filter);
    const appointments = await Appointment.find(filter)
      .sort({ date_time: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("patient_id")
      .populate("doctor_id")
      .lean();
    const totalPages = Math.ceil(total / limit);
    return {
      appointments,
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
    return await Appointment.findById(id)
      .populate("patient_id")
      .populate("doctor_id")
      .lean();
  },
  async create(data) {
    const appointment = new Appointment(data);
    await appointment.save();
    return appointment;
  },
  async update(id, data) {
    return await Appointment.findByIdAndUpdate(id, data, { new: true }).lean();
  },
  async remove(id) {
    await Appointment.findByIdAndDelete(id);
  },
};
