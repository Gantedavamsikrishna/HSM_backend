const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  specialization: { type: String, required: true },
  licenseNumber: { type: String, required: true },
  experience: { type: Number, required: true },
  consultationFee: { type: Number, required: true },
  schedule: [
    {
      day: { type: String, required: true },
      startTime: { type: String, required: true },
      endTime: { type: String, required: true },
      isAvailable: { type: Boolean, default: true },
    },
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Doctor", doctorSchema);
