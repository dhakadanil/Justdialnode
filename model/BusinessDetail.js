// models/BusinessDetail.js
const mongoose = require("mongoose");

const BusinessDetailSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Business",
    required: true
  },

  bannerImage: String,

  gallery: [String],

  description: String,

   services: [String],
  // 🔥 Dynamic blocks (GYM / RESTAURANT / SALON / etc)
  sections: [
    {
      title: String,          // e.g. "Services", "Menu", "Facilities"
      items: [
        {
          name: String,       // e.g. "Hair Cut", "Protein Shake"
          price: Number,      // optional
          image: String,      // optional
          description: String
        }
      ]
    }
  ],

  status: { type: Boolean, default: true }

}, { timestamps: true });

module.exports = mongoose.model("BusinessDetail", BusinessDetailSchema);
