const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  dateOfBirth: { type: String, required: true },
  gender: { type: String, enum: ["male", "female", "other"], required: true },
  address: { type: String },
  emergencyContact: { type: String },
  emergencyPhone: { type: String },
  medicalHistory: { type: String },
  allergies: { type: String },
  bloodGroup: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Patient", patientSchema);
