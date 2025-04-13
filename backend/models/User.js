const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  languageCode: { type: String, default: "en-US" },
  chatHistory: [
    {
      role: { type: String, enum: ["user", "assistant"] },
      content: String,
    }
  ],
});

const User = mongoose.model("User", userSchema);

module.exports = User;
