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
  
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "텍스트가 없습니다." });
    }
  
    const voiceMap = {
      "en-US": "en-US-Wavenet-F",
      "ko-KR": "ko-KR-Wavenet-A",
      "ja-JP": "ja-JP-Wavenet-A",
      "fr-FR": "fr-FR-Wavenet-A",
      "es-ES": "es-ES-Wavenet-A",
      "zh-CN": "zh-CN-Wavenet-A",
    };
  
    const request = {
      input: { text },
      voice: {
        languageCode,
        name: voiceMap[languageCode] || languageCode,
        ssmlGender: "FEMALE",
      },
      audioConfig: { audioEncoding: "MP3" },
    };

    console.log("🎙️ TTS 요청 언어:", languageCode);
    console.log("🔊 선택된 목소리:", request.voice.name);
  
    try {
      const [response] = await client.synthesizeSpeech(request);
      const audioBase64 = response.audioContent.toString("base64");
      res.json({ audioContent: audioBase64 });
    } catch (error) {
      console.error("TTS 오류:", error);
      res.status(500).json({ error: "TTS 처리 실패" });
    }
  });

// 💬 GPT 응답
app.post("/chat", async (req, res) => {
    const {
      message,
      level = "beginner",
      languageCode = "en-US"
    } = req.body;
  
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "메시지가 비어있습니다." });
    }
  
    // 🔥 난이도 설명 프롬프트 추가
    let levelDescription = "";
    if (level === "beginner") {
      levelDescription = "Use short, simple sentences and very basic words. Speak slowly and clearly.";
    } else if (level === "intermediate") {
      levelDescription = "Speak naturally and use common everyday phrases. You can include some slang.";
    } else if (level === "advanced") {
      levelDescription = "Speak freely using natural, complex expressions, idioms, and jokes if appropriate.";
    }
  
    try {
      const gptResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `
  You are a friendly and casual language partner.
  Have a natural, fun conversation with the user.
  ${levelDescription}
  Reply in ${languageCode}.
            `.trim()
          },
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
