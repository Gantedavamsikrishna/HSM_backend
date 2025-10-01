const mongoose = require("mongoose");

const billItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  type: {
    type: String,
    enum: ["consultation", "medicine", "test", "procedure", "other"],
    required: true,
  },
});

const billSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true,
  },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
  items: [billItemSchema],
  totalAmount: { type: Number, required: true },
  paidAmount: { type: Number, required: true },
  status: {
    type: String,
    enum: ["pending", "partial", "paid", "cancelled"],
    default: "pending",
  },
  paymentMethod: { type: String },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Bill", billSchema);
