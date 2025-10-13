const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const textToSpeech = require("@google-cloud/text-to-speech");
const { getGPTResponse } = require("./gpt");
const connectMongo = require("./mongo");
const Mistake = require("./models/Mistake");
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const User = require("./models/User");
const verifyToken = require("./middleware/auth"); // 인증 미들웨어 추가

dotenv.config();

const app = express();
const ttsClient = new textToSpeech.TextToSpeechClient();

app.use(cors());
app.use(express.json());

connectMongo();

/* ── 퀴즈 라우트 마운트 ─────────────────────────────────────── */
const quizRouter = require("./routes/quiz");
app.use("/quiz", quizRouter);

/* ── TTS ───────────────────────────────────────────────────── */
app.post("/speak", verifyToken, async (req, res) => {
  const { text, languageCode = "en-US", gender = "NEUTRAL", situation = "" } = req.body;

  const genderMap = {
    "izakaya-banker": "MALE",
    "airport-traveler": "MALE",
    default: "NEUTRAL",
  };
  const voiceMap = {
    "en-US": { MALE: "en-US-Studio-M", FEMALE: "en-US-Studio-O", NEUTRAL: "en-US-Studio-O" },
    "ja-JP": { MALE: "ja-JP-Neural2-C", FEMALE: "ja-JP-Neural2-B", NEUTRAL: "ja-JP-Neural2-B" },
    "ko-KR": { MALE: "ko-KR-Neural2-B", FEMALE: "ko-KR-Neural2-A", NEUTRAL: "ko-KR-Neural2-B" },
  };

  const selectedGender = situation && genderMap[situation] ? genderMap[situation] : gender;
  const voiceName = voiceMap[languageCode]?.[selectedGender] || voiceMap[languageCode]?.NEUTRAL;

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "텍스트가 없습니다." });
  }

  let speakingRate = 0.85;
  let pitch = -4;
  if (situation === "izakaya-banker") {
    speakingRate = 1.0; pitch = -6;
  } else if (situation === "airport-traveler") {
    speakingRate = 0.95; pitch = 1;
  }

  const request = {
    input: { text },
    voice: { languageCode, name: voiceName },
    audioConfig: { audioEncoding: "MP3", speakingRate, pitch },
  };

  try {
    const [response] = await ttsClient.synthesizeSpeech(request);
    res.json({ audioContent: response.audioContent.toString("base64") });
  } catch (err) {
    console.error("TTS 오류:", err.message);
    res.status(500).json({ error: "TTS 실패" });
  }
});

/* ── Chat ───────────────────────────────────────────────────── */
app.post("/chat", verifyToken, async (req, res) => {
  const { uid } = req.user; 
  const { message, languageCode, situation, difficulty } = req.body;
  if (!message) {
    return res.status(400).json({ error: "메시지가 없습니다." });
  }
  try {
    const reply = await getGPTResponse(message, languageCode, uid, situation, difficulty);
    res.json({ response: reply });
  } catch (err) {
    console.error("GPT 오류:", err.message);
    res.status(500).json({ error: "GPT 응답 실패" });
  }
});

/* ── Translate ──────────────────────────────────────────────── */
app.post("/translate", verifyToken, async (req, res) => {
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
          { role: "system", content: "Translate the following sentence to Korean in a natural, fluent way." },
          { role: "user", content: text },
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

/* ── Pronounce ──────────────────────────────────────────────── */
app.post("/pronounce", verifyToken, async (req, res) => {
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
            content:
              "Your task is to convert the user's sentence into a Hangul (Korean alphabet) phonetic transcription. This helps a Korean speaker read it to approximate the original pronunciation. - DO NOT translate the meaning of the sentence. - ONLY provide the phonetic transcription in Hangul. - Example 1: If the input is 'I love you', the output must be '아이 러브 유'. - Example 2: If the input is 'わたしはげんきです', the output must be '와타시와 겡키데스'.",
          },
          { role: "user", content: text },
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

/* ── Review / Progress ──────────────────────────────────────── */
app.get("/review/mistakes", verifyToken, async (req, res) => {
  const { uid } = req.user;
  const data = await Mistake.find({ userId: uid }).sort({ createdAt: -1 });
  res.json(data);
});

app.get("/progress", verifyToken, async (req, res) => {
  const { uid } = req.user;
  try {
    const user = await User.findOne({ userId: uid });
    const messageCount = user ? user.chatHistory.filter(m => m.role === "user").length : 0;
    const mistakeCount = await Mistake.countDocuments({ userId: uid });
    res.json({ messageCount, mistakeCount });
  } catch (err) {
    console.error("진행률 조회 실패:", err.message);
    res.status(500).json({ error: "진행률 조회 실패" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});

console.log("[OPENAI_KEY_PREFIX]", (process.env.OPENAI_API_KEY||"").slice(0,8));