const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const textToSpeech = require("@google-cloud/text-to-speech");
const { getGPTResponse } = require("./gpt");
const connectMongo = require("./mongo");
const Mistake = require("./models/Mistake");
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const User = require("./models/User");

dotenv.config();

const app = express();
const ttsClient = new textToSpeech.TextToSpeechClient();

app.use(cors());
app.use(express.json());

connectMongo(); // ✅ MongoDB 연결

app.post("/speak", async (req, res) => {
  const { text, languageCode = "en-US", gender = "NEUTRAL", situation = "" } = req.body;

  const genderMap = {
    "izakaya-banker": "MALE",
    "airport-traveler": "MALE",
    default: "NEUTRAL",
  };

  // --- ✨ 수정된 부분: 더 자연스러운 최신 목소리로 교체 ---
  const voiceMap = {
    "en-US": {
      MALE: "en-US-Studio-M",       // Studio 등급 남성 목소리
      FEMALE: "en-US-Studio-O",     // Studio 등급 여성 목소리
      NEUTRAL: "en-US-Studio-O"     // 기본값은 여성 목소리로 설정
    },
    "ja-JP": {
      MALE: "ja-JP-Neural2-C",      // Neural2 등급 남성 목소리
      FEMALE: "ja-JP-Neural2-B",      // Neural2 등급 여성 목소리
      NEUTRAL: "ja-JP-Neural2-B"      // 기본값은 여성 목소리로 설정
    }
  };

  const selectedGender = situation && genderMap[situation]
    ? genderMap[situation]
    : gender;
  const voiceName = voiceMap[languageCode]?.[selectedGender] || languageCode;

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "텍스트가 없습니다." });
  }
  
  let speakingRate = 1.0; // 기본 말하기 속도
  let pitch = 0; // 기본 음높이

  if (situation === "izakaya-banker") {
    speakingRate = 1.0;
    pitch = -6;
  } else if (situation === "airport-traveler") {
    speakingRate = 0.95;
    pitch = 1;
  }

  const request = {
    input: { text },
    voice: {
      languageCode,
      name: voiceName,
    },
    audioConfig: { 
      audioEncoding: "MP3",
      speakingRate,
      pitch
    },
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
  const { message, languageCode, sessionId, situation, difficulty } = req.body;

  if (!message || !sessionId) {
    return res.status(400).json({ error: "메시지나 세션 ID가 없습니다." });
  }

  try {
    const reply = await getGPTResponse(message, languageCode, sessionId, situation, difficulty);
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
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
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
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: `Your task is to convert the user's sentence into a Hangul (Korean alphabet) phonetic transcription. This helps a Korean speaker read it to approximate the original pronunciation.
- DO NOT translate the meaning of the sentence.
- ONLY provide the phonetic transcription in Hangul.
- Example 1: If the input is 'I love you', the output must be '아이 러브 유'.
- Example 2: If the input is 'わたしはげんきです', the output must be '와타시와 겡키데스'.`
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

app.get("/review/mistakes/:userId", async (req, res) => {
  const { userId } = req.params;
  const data = await Mistake.find({
    userId: userId
  }).sort({ createdAt: -1 });
  res.json(data);
});

// 📊 진행률 (Progress)
app.get("/progress/:userId", async (req, res) => {
  const { userId } = req.params;
  
  try {
    const user = await User.findOne({ userId });
    const messageCount = user
      ? user.chatHistory.filter(m => m.role === "user").length
      : 0;

    const mistakeCount = await Mistake.countDocuments({ userId });

    res.json({
      messageCount,
      mistakeCount
    });
  } catch (err) {
    console.error("진행률 조회 실패:", err.message);
    res.status(500).json({ error: "진행률 조회 실패" });
  }
});

// ✅ 서버 실행
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
