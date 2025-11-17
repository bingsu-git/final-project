const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const textToSpeech = require('@google-cloud/text-to-speech');

const { getGPTResponse, callOpenAI } = require('./gpt');
const { getRagResponse } = require('./ragService');

const connectMongo = require('./mongo');
const Mistake = require('./models/Mistake');
const User = require('./models/User');

const verifyToken = require('./middleware/auth');
const quizRouter = require('./routes/quiz');
const patternRouter = require('./routes/pattern'); // 문법 패턴 분석 라우터가 있다면

const { getExampleUtterances } = require('./gpt');

dotenv.config();

const app = express();
const ttsClient = new textToSpeech.TextToSpeechClient();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());

// MongoDB 연결
connectMongo().catch((err) => {
  console.error('MongoDB 연결 실패:', err);
  process.exit(1);
});

app.get('/', (_req, res) => {
  res.send('ChatBuddy API is running');
});

/* ──────────────────────
 * 1. 롤플레잉 대화 (/chat)
 * ────────────────────── */
app.post('/chat', verifyToken, async (req, res) => {
  const { message, languageCode, situation, difficulty } = req.body || {};
  const { uid } = req.user || {};

  if (!message) {
    return res.status(400).json({ error: '메시지가 없습니다.' });
  }

  try {
    const reply = await getGPTResponse(
      message,
      languageCode,
      uid,
      situation,
      difficulty
    );
    res.json({ response: reply });
  } catch (err) {
    console.error('GPT 오류(/chat):', err);
    res.status(500).json({ error: '대화 생성 실패' });
  }
});

app.post('/examples', verifyToken, async (req, res) => {
  try {
    const {
      languageCode = 'en-US',
      situation = '',
      difficulty = 'medium',
      lastAssistantMessage = null,
      history = [],
    } = req.body || {};

    const examples = await getExampleUtterances({
      languageCode,
      situation,
      difficulty,
      lastAssistantMessage,
      history,
    });

    res.json({ examples });
  } catch (err) {
    console.error('[Examples Error]', err);
    res.status(500).json({ error: 'failed_to_generate_examples' });
  }
});

/* ──────────────────────
 * 2. 법률 RAG Q&A (/chat-rag)
 * ────────────────────── */

// 실제 RAG 질의응답
app.post('/chat-rag', verifyToken, async (req, res) => {
  const { message } = req.body || {};
  if (!message) {
    return res.status(400).json({ error: '메시지가 없습니다.' });
  }

  try {
    const reply = await getRagResponse(message);
    res.json({ response: reply });
  } catch (err) {
    console.error('RAG Service Error(/chat-rag):', err);
    res.status(500).json({ error: 'RAG 응답 실패' });
  }
});

// RAG 질문 예시 생성
app.get('/chat-rag/examples', verifyToken, async (_req, res) => {
  try {
    const messages = [
      {
        role: 'system',
        content: `
당신은 한국어로만 답하는 법률·IT 규제 전문가입니다.
처음 서비스를 사용하는 사람이 참고할 수 있도록
질문 예시 3~5개를 만들어 주세요.

주제는 개인정보 보호법, 정보통신망법, 전자상거래법, 저작권법, 근로기준법을 중심으로 합니다.
각 예시는 한 문장짜리 자연스러운 질문이어야 하며,
번호나 불릿 없이 문장만 출력하세요.
        `.trim(),
      },
      {
        role: 'user',
        content: '질문 예시를 한국어 한 문장으로 여러 개 만들어줘.',
      },
    ];

    const data = await callOpenAI({
      messages,
      model: 'gpt-4o-mini',
      temperature: 0.4,
    });

    const raw = data?.choices?.[0]?.message?.content || '';
    const examples = raw
      .split(/\n+/)
      .map((s) => s.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean)
      .slice(0, 5);

    res.json({ examples });
  } catch (err) {
    console.error('RAG 예시 생성 오류:', err);
    res.status(500).json({ error: '예시 생성 실패' });
  }
});

/* ──────────────────────
 * 3. Google TTS (/speak)
 * ────────────────────── */
app.post('/speak', verifyToken, async (req, res) => {
  const { text, languageCode } = req.body || {};
  if (!text) {
    return res.status(400).json({ error: '텍스트가 없습니다.' });
  }

  try {
    const request = {
      input: { text },
      voice: {
        languageCode: languageCode || 'en-US',
        ssmlGender: 'NEUTRAL',
      },
      audioConfig: {
        audioEncoding: 'MP3',
      },
    };

    const [response] = await ttsClient.synthesizeSpeech(request);
    res.json({ audioContent: response.audioContent.toString('base64') });
  } catch (err) {
    console.error('TTS 오류(/speak):', err);
    res.status(500).json({ error: 'TTS 실패' });
  }
});

/* ──────────────────────
 * 4. 번역 / 발음 (/translate, /pronounce)
 * ────────────────────── */
app.post('/translate', verifyToken, async (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: '텍스트가 없습니다.' });

  try {
    const messages = [
      {
        role: 'system',
        content:
          '당신은 영어/일본어 문장을 자연한 한국어로 번역해 주는 번역기입니다.',
      },
      { role: 'user', content: text },
    ];
    const data = await callOpenAI({
      messages,
      model: 'gpt-4o-mini',
      temperature: 0.2,
    });

    const result = data?.choices?.[0]?.message?.content?.trim() || '';
    res.json({ result });
  } catch (err) {
    console.error('번역 오류(/translate):', err);
    res.status(500).json({ error: '번역 실패' });
  }
});

// ✨ [추가] 아바타 조회
app.get("/profile/avatars", verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const user = await User.findOne({ userId: uid }).lean();
    res.json({
      userAvatar: user?.userAvatar || null,
      assistantAvatar: user?.assistantAvatar || null,
    });
  } catch (e) {
    console.error("GET /profile/avatars error:", e);
    res.status(500).json({ error: "avatar_fetch_failed" });
  }
});

// ✨ [추가] 아바타 저장/업데이트
app.post("/profile/avatars", verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const { userAvatar, assistantAvatar } = req.body || {};

    const update = {};
    if (typeof userAvatar === "string") update.userAvatar = userAvatar;
    if (typeof assistantAvatar === "string") update.assistantAvatar = assistantAvatar;

    const user = await User.findOneAndUpdate(
      { userId: uid },
      { $set: update },
      { new: true, upsert: true }
    ).lean();

    res.json({
      userAvatar: user.userAvatar || null,
      assistantAvatar: user.assistantAvatar || null,
    });
  } catch (e) {
    console.error("POST /profile/avatars error:", e);
    res.status(500).json({ error: "avatar_update_failed" });
  }
});


app.post('/pronounce', verifyToken, async (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: '텍스트가 없습니다.' });

  try {
    const messages = [
      {
        role: 'system',
        content:
          '당신은 발음 도우미입니다. 사용자가 보낸 문장의 발음을, 한글 또는 발음 기호로만 간단히 적어 주세요.',
      },
      { role: 'user', content: text },
    ];
    const data = await callOpenAI({
      messages,
      model: 'gpt-4o-mini',
      temperature: 0.3,
    });

    const result = data?.choices?.[0]?.message?.content?.trim() || '';
    res.json({ result });
  } catch (err) {
    console.error('발음 생성 오류(/pronounce):', err);
    res.status(500).json({ error: '발음 생성 실패' });
  }
});

/* ──────────────────────
 * 5. Mistake 리뷰 (/review/mistakes)
 * ────────────────────── */

// Mistake 목록
app.get('/review/mistakes', verifyToken, async (req, res) => {
  const { uid } = req.user;
  try {
    const mistakes = await Mistake.find({ userId: uid })
      .sort({ createdAt: -1 })
      .lean();
    res.json(mistakes);
  } catch (err) {
    console.error('복습 데이터 조회 오류:', err);
    res.status(500).json({ error: '복습 데이터 조회 실패' });
  }
});

// Mistake 삭제
app.delete('/review/mistakes/:id', verifyToken, async (req, res) => {
  const { uid } = req.user;
  const { id } = req.params;

  try {
    const result = await Mistake.deleteOne({ _id: id, userId: uid });
    res.json({ ok: true, deleted: result.deletedCount });
  } catch (err) {
    console.error('복습 데이터 삭제 오류:', err);
    res.status(500).json({ error: '복습 데이터 삭제 실패' });
  }
});

/* ──────────────────────
 * 6. 진행률 요약 (/progress)
 * ────────────────────── */
app.get('/progress', verifyToken, async (req, res) => {
  const { uid } = req.user;
  try {
    const userDoc = await User.findOne({ userId: uid }).lean();
    const messageCount = userDoc
      ? userDoc.chatHistory.filter((m) => m.role === 'user').length
      : 0;
    const mistakeCount = await Mistake.countDocuments({ userId: uid });

    res.json({ messageCount, mistakeCount });
  } catch (err) {
    console.error('진행률 조회 오류:', err);
    res.status(500).json({ error: '진행률 조회 실패' });
  }
});

/* ──────────────────────
 * 7. 외부 라우터: 퀴즈, 패턴 분석
 * ────────────────────── */
app.use('/quiz', quizRouter);
app.use('/pattern', patternRouter); // routes/pattern.js 사용 중일 때

/* ──────────────────────
 * 서버 시작
 * ────────────────────── */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
