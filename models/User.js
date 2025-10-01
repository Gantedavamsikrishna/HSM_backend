const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  first_name: { type: String, required: true },
  last_name: { type: String, required: true },
  role: {
    type: String,
    required: true,
    enum: ["admin", "doctor", "reception", "lab"],
  },
  phone: { type: String },
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

userSchema.index({ email: 1 });

module.exports = mongoose.model("User", userSchema);
