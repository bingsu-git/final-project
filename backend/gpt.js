// backend/gpt.js
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const User = require("./models/User");
const { getSystemPrompt } = require("./prompts");
const { checkGrammarHybrid } = require('./grammarChecker');

const CONTEXT_WINDOW_SIZE = 20;

// 환경 변수로 모델을 바꿀 수 있게 하고, 기본은 최신 가벼운 모델 사용
const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

// 공통 OpenAI 호출 함수: 에러 바디까지 모두 로깅
async function callOpenAIChat(messages, { temperature = 0.2, model = CHAT_MODEL } = {}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY 가 설정되어 있지 않습니다.");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, temperature, messages }),
    // node-fetch v2는 timeout 옵션이 없어서 AbortController를 쓰는 게 정석이지만,
    // 간단하게는 인프라 네트워크만 확인해도 됨.
  });

  const text = await res.text(); // 먼저 텍스트로 받았다가 JSON 파싱
  if (!res.ok) {
    // 에러 바디를 그대로 로그로 남김
    throw new Error(`OpenAI API ${res.status} ${res.statusText} - ${text}`);
  }

  let data;
  try { data = JSON.parse(text); } catch (e) {
    throw new Error(`OpenAI 응답 JSON 파싱 실패: ${e.message}. body=${text.slice(0, 500)}`);
  }

  const reply = data?.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    throw new Error(`OpenAI 응답에 message.content가 없음. body=${text.slice(0, 500)}`);
  }
  return reply;
}

// sessionId 대신 userId(Firebase uid)를 받아서 히스토리 유지
async function getGPTResponse(message, languageCode = "ja-JP", userId = "", situation = "", difficulty = "medium") {
  const systemPrompt = getSystemPrompt(languageCode, situation, difficulty);

  // 사용자 문서 확보
  let user = await User.findOne({ userId });
  if (!user) {
    user = await User.create({
      userId,
      languageCode,
      chatHistory: [],
    });
  }

  const recentHistory = user.chatHistory.slice(-CONTEXT_WINDOW_SIZE);
  const messages = [
    { role: "system", content: systemPrompt },
    ...recentHistory,
    { role: "user", content: message }
  ];

  try {
    const reply = await callOpenAIChat(messages, { temperature: 0.2 });
    // 성공 시 히스토리 기록
    user.chatHistory.push({ role: "user", content: message });
    user.chatHistory.push({ role: "assistant", content: reply });
    await user.save();

    // 문법 검사 기록
    try {
      await checkGrammarHybrid(userId, message, languageCode);
    } catch (e) {
      console.warn("[GrammarChecker] non-blocking error:", e.message);
    }

    return reply;
  } catch (err) {
    // 서버 로그에 원인 남기고, 프런트엔드는 500 처리
    console.error("[OpenAI chat error]", err.message);
    throw err; // index.js에서 500으로 전달
  }
}

module.exports = { getGPTResponse };
