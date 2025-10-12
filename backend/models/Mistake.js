const mongoose = require('mongoose');

const MistakeSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  original: { type: String, required: true },
  corrected: { type: String, required: true },
  explanation: { type: String },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Mistake', MistakeSchema);