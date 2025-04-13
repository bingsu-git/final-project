const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const textToSpeech = require("@google-cloud/text-to-speech");
const { getGPTResponse } = require("./gpt");
const connectMongo = require("./mongo");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

dotenv.config();

const app = express();
const ttsClient = new textToSpeech.TextToSpeechClient();

app.use(cors());
app.use(express.json());

connectMongo(); // ✅ MongoDB 연결

// 🎤 Google TTS
app.post("/speak", async (req, res) => {
  const { text, languageCode = "en-US", gender = "NEUTRAL" } = req.body;

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "텍스트가 없습니다." });
  }

  const voiceMap = {
    "en-US": "en-US-Wavenet-F",
    "ja-JP": "ja-JP-Wavenet-A",
  };

  const request = {
    input: { text },
    voice: {
      languageCode,
      name: voiceMap[languageCode] || languageCode,
      ssmlGender: gender,
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

// 💬 GPT 대화
app.post("/chat", async (req, res) => {
  const { message, languageCode = "en-US", sessionId, situation = "" } = req.body;

  if (!message || !sessionId) {
    return res.status(400).json({ error: "메시지나 세션 ID가 없습니다." });
  }

  try {
    const reply = await getGPTResponse(message, languageCode, sessionId, situation);
    res.json({ response: reply });
  } catch (err) {
    console.error("GPT 오류:", err.message);
    res.status(500).json({ error: "GPT 응답 실패" });
  }
});

// 🌐 번역 (Translate)
app.post("/translate", async (req, res) => {
  const { text } = req.body;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: "Translate the following sentence to Korean in a natural, fluent way.",
          },
          {
            role: "user",
            content: text,
          },
        ],
      }),
    });

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content?.trim() || "";
    res.json({ result });
  } catch (err) {
    console.error("번역 오류:", err.message);
    res.status(500).json({ error: "번역 실패" });
  }
});

// 🗣️ 발음 (Pronunciation)
app.post("/pronounce", async (req, res) => {
  const { text } = req.body;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "다음 문장을 한국인이 이해할 수 있도록 한글 발음(로마자 X, 한글식 표기)으로 변환해줘. 예: わたし → 와타시",
          },
          {
            role: "user",
            content: text,
          },
        ],
      }),
    });

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content?.trim() || "";
    res.json({ result });
  } catch (err) {
    console.error("발음 오류:", err.message);
    res.status(500).json({ error: "발음 변환 실패" });
  }
});

// ✅ 서버 실행
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
