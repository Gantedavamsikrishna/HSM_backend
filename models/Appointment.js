// Appointment.js
// Mongoose model for appointments
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const appointmentSchema = new Schema({
  patient_id: { type: Schema.Types.ObjectId, ref: "Patient", required: true },
  doctor_id: { type: Schema.Types.ObjectId, ref: "Doctor", required: true },
  date_time: { type: Date, required: true },
  status: {
    type: String,
    enum: ["scheduled", "completed", "cancelled"],
    default: "scheduled",
  },
  reason: { type: String, required: true },
  notes: { type: String },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Appointment", appointmentSchema);
