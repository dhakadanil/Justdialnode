const mongoose = require("mongoose");

const CategorySchema = new mongoose.Schema({
  name: String,
 image: String,
  status: Boolean
  
});

module.exports = mongoose.model("Category", CategorySchema);
