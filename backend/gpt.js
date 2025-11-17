// backend/gpt.js
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const User = require("./models/User");
const { getSystemPrompt } = require("./prompts");
const { checkGrammar } = require("./grammarChecker");

const CONTEXT_WINDOW_SIZE = 20;
const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";
// RAG용 임베딩 모델
const EMBEDDING_MODEL = "text-embedding-3-small";

/**
 * 공용 OpenAI 호출 함수 (Chat Completion)
 */
async function callOpenAI({
  messages,
  model = "gpt-4o-mini",
  temperature = 0.2,
  responseFormat = null,
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY 가 설정되어 있지 않습니다.");
  }

  const body = { model, temperature, messages };
  if (responseFormat) {
    body.response_format = responseFormat;
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`OpenAI API ${res.status} ${res.statusText} - ${text}`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(
      `OpenAI 응답 JSON 파싱 실패: ${e.message}. body=${text.slice(0, 500)}`
    );
  }
  return data;
}

/**
 * 텍스트 → 임베딩 벡터 (RAG용)
 */
async function createEmbedding(text) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY 가 설정되어 있지 않습니다.");
  }

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: text,
      model: EMBEDDING_MODEL,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`OpenAI Embedding API ${res.status} - ${errorBody}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

/**
 * 회화 예시 실패 시 마지막 안전망 (언어별 기본 문장)
 */
function getDefaultFallback(languageCode) {
  if (languageCode === "ja-JP") {
    return [
      "すみません、アイスコーヒーを一つお願いします。",
      "おすすめのメニューはありますか？",
      "もう少しゆっくり話してもらえますか？",
      "テイクアウトできますか？",
    ];
  }

  // 기본: 영어
  return [
    "Hi, I would like to order a coffee.",
    "Could you recommend something sweet?",
    "Sorry, could you speak a little more slowly?",
    "Is this seat taken?",
  ];
}

/**
 * 상황/난이도에 맞는 회화 예시 문장 4개 생성
 * (프론트에서 /examples 라우트가 이 함수를 호출)
 */
async function getExampleUtterances(
  languageCode,
  situation = "",
  difficulty = "medium"
) {
  const localeLabel = languageCode === "ja-JP" ? "Japanese" : "English";

  const sys = `
You are a friendly ${localeLabel} speaking partner for a language learner.
Given a scenario and difficulty level, suggest 4 short example sentences
that the learner might say to start or continue the conversation.

Rules:
- Output MUST be ONLY a JSON array of strings, e.g. ["...", "..."].
- Do not include explanations, numbering, or any extra text.
- Make sure each sentence fits the given scenario and difficulty.
  `.trim();

  const userContent = JSON.stringify({
    languageCode,
    difficulty,
    situation,
  });

  let data;
  try {
    data = await callOpenAI({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: userContent },
      ],
    });
  } catch (e) {
    console.error("[getExampleUtterances] OpenAI 호출 실패:", e.message);
    return getDefaultFallback(languageCode);
  }

  const text = data?.choices?.[0]?.message?.content || "[]";

  // 1순위: JSON 배열 파싱 시도
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      const cleaned = parsed
        .map((s) => String(s || "").trim())
        .filter(Boolean);
      if (cleaned.length > 0) return cleaned.slice(0, 4);
    }
  } catch (e) {
    // JSON 파싱 실패시 아래에서 줄바꿈 기반 파싱 시도
  }

  // 2순위: 줄바꿈/리스트 마크 제거해서 배열 구성
  const fallbackList = text
    .split("\n")
    .map((l) => l.replace(/^\s*[-*•\d.]+\s*/, "").trim())
    .filter(Boolean);

  if (fallbackList.length > 0) {
    return fallbackList.slice(0, 4);
  }

  // 그래도 실패하면 언어별 기본 예시로
  return getDefaultFallback(languageCode);
}

/**
 * 역할극 대화 메인 함수
 */
async function getGPTResponse(
  message,
  languageCode = "ja-JP",
  userId = "",
  situation = "",
  difficulty = "medium"
) {
  const systemPrompt = getSystemPrompt(languageCode, situation, difficulty);

  let user = await User.findOne({ userId });
  if (!user) {
    user = await User.create({ userId, languageCode, chatHistory: [] });
  }

  const recentHistory = user.chatHistory.slice(-CONTEXT_WINDOW_SIZE);

  const messages = [
    { role: "system", content: systemPrompt },
    ...recentHistory,
    { role: "user", content: message },
  ];

  try {
    const data = await callOpenAI({
      messages,
      model: CHAT_MODEL,
      temperature: 0.2,
    });

    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      throw new Error("OpenAI 응답에 message.content가 없음.");
    }

    user.chatHistory.push({ role: "user", content: message });
    user.chatHistory.push({ role: "assistant", content: reply });
    await user.save();

    // 문법 체크는 실패해도 대화 자체는 진행되도록 비차단
    try {
      await checkGrammar(userId, message, languageCode);
    } catch (e) {
      console.warn("[GrammarChecker] non-blocking error:", e.message);
    }

    return reply;
  } catch (err) {
    console.error("[OpenAI chat error]", err.message);
    throw err;
  }
}

module.exports = {
  getGPTResponse,
  callOpenAI,
  createEmbedding,
  getExampleUtterances,
};
