const mongoose = require("mongoose");

const BusinessSchema = new mongoose.Schema({
  name: String,
   category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
  mobile: String,
  whatsapp: String,
  address: String,
  city: String,
  status: { type: Boolean, default: true },
  image: String,
}, { timestamps: true });
module.exports = mongoose.model("Business", BusinessSchema);
