const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();

const textToSpeech = require("@google-cloud/text-to-speech");
const { OpenAI } = require("openai");

const app = express();
const client = new textToSpeech.TextToSpeechClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json());

// 🎤 TTS
app.post("/speak", async (req, res) => {
  const { text, languageCode = "en-US", gender = "NEUTRAL" } = req.body;

  try {
    const request = {
      input: { text },
      voice: { languageCode, ssmlGender: gender },
      audioConfig: { audioEncoding: "MP3" },
    };
    const [response] = await client.synthesizeSpeech(request);
    const audioBase64 = response.audioContent.toString("base64");
    res.json({ audioContent: audioBase64 });
  } catch (error) {
    console.error("🔴 TTS 오류:", error);
    res.status(500).json({ error: "TTS 처리 실패" });
  }
});

// 💬 GPT 응답
app.post("/chat", async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "메시지가 비어있습니다." });
  }

  try {
    const gptResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // 필요하면 "gpt-4"로 변경
      messages: [
        { role: "system", content: "You are a helpful foreign language tutor." },
        { role: "user", content: message },
      ],
    });

    const reply = gptResponse.choices[0].message.content.trim();
    res.json({ response: reply });
  } catch (error) {
    console.error("🔴 GPT 오류:", error);
    res.status(500).json({ error: "GPT 응답 실패" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ 백엔드 서버 실행 중: http://localhost:${PORT}`);
});
