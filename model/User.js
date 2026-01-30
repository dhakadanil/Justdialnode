// =======================
// User Schema
const mongoose = require('mongoose');

// =======================
const UserSchema = new mongoose.Schema({
  email:String,
  password:String,
  otp:String,
  otpExpire:Date
});

module.exports = mongoose.model("User ",UserSchema);