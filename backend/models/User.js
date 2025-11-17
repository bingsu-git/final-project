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

  // ✨ [추가] 아바타 이미지 (data URL)
  userAvatar: { type: String, default: null },
  assistantAvatar: { type: String, default: null },
});

const User = mongoose.model("User", userSchema);

module.exports = User;
