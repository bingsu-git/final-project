const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectMongo = require("./mongo");
const { getGPTResponse } = require("./gpt");
const textToSpeech = require("@google-cloud/text-to-speech");

const app = express();
const ttsClient = new textToSpeech.TextToSpeechClient();

app.use(cors());
app.use(express.json());

connectMongo(); // MongoDB 연결

// TTS 엔드포인트
app.post("/speak", async (req, res) => {
  const { text, languageCode = "en-US" } = req.body;

  const voiceMap = {
    "en-US": "en-US-Wavenet-F",
    "ja-JP": "ja-JP-Wavenet-A"
  };

  const request = {
    input: { text },
    voice: {
      languageCode,
      name: voiceMap[languageCode] || languageCode,
      ssmlGender: "NEUTRAL",
    },
    audioConfig: { audioEncoding: "MP3" },
  };

  try {
    const [response] = await ttsClient.synthesizeSpeech(request);
    res.json({ audioContent: response.audioContent.toString("base64") });
  } catch (err) {
    console.error("TTS 오류:", err.message);
    res.status(500).json({ error: "TTS 실패" });
  }
});

// GPT 응답 엔드포인트
app.post("/chat", async (req, res) => {
  const { message, languageCode = "en-US", sessionId } = req.body;
  if (!message || !sessionId) {
    return res.status(400).json({ error: "메시지나 세션 ID가 없습니다." });
  }

  try {
    const reply = await getGPTResponse(message, languageCode, sessionId);
    res.json({ response: reply });
  } catch (err) {
    console.error("GPT 오류:", err.message);
    res.status(500).json({ error: "GPT 응답 실패"
