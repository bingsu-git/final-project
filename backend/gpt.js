const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const User = require("./models/User");
const { getSystemPrompt } = require("./prompts");
const { checkGrammar } = require('./grammarChecker');

const CONTEXT_WINDOW_SIZE = 20;
const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

// ✨ [핵심 수정]
// 1. 함수 이름을 'callOpenAI'로 변경하고 'export' 키워드를 추가했습니다.
// 2. 이 함수가 'messages', 'model', 'temperature'를 인자로 받도록 하여,
//    번역, 발음 변환 등 다양한 작업에 재사용할 수 있도록 범용성을 높였습니다.
async function callOpenAI({
  messages,
  model = "gpt-4o-mini", // 기본 모델 설정
  temperature = 0.2,   // 기본 온도 설정
  responseFormat = null // JSON 모드 등 추가 옵션
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY 가 설정되어 있지 않습니다.");
  }

  const body = {
    model,
    temperature,
    messages
  };

  // JSON 모드 옵션이 있으면 body에 추가
  if (responseFormat) {
    body.response_format = responseFormat;
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`OpenAI API ${res.status} ${res.statusText} - ${text}`);
  }

  let data;
  try { data = JSON.parse(text); } catch (e) {
    throw new Error(`OpenAI 응답 JSON 파싱 실패: ${e.message}. body=${text.slice(0, 500)}`);
  }

  // ✨ [수정] 응답 구조를 data 객체 그대로 반환하여 유연성 확보
  // (예: grammarChecker.js에서 JSON.parse(content) 대신 data.choices[0].message.content를 바로 사용)
  return data;
}

async function getGPTResponse(message, languageCode = "ja-JP", userId = "", situation = "", difficulty = "medium") {
  const systemPrompt = getSystemPrompt(languageCode, situation, difficulty);

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
    // ✨ [수정] 새로 만든 범용 'callOpenAI' 함수를 호출합니다.
    const data = await callOpenAI({
      messages,
      model: CHAT_MODEL, // 채팅 전용 모델 사용
      temperature: 0.2
    });
    
    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      throw new Error(`OpenAI 응답에 message.content가 없음.`);
    }

    user.chatHistory.push({ role: "user", content: message });
    user.chatHistory.push({ role: "assistant", content: reply });
    await user.save();

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

// ✨ [핵심 수정] 'getGPTResponse'와 함께 'callOpenAI' 함수도 export 합니다.
module.exports = { getGPTResponse, callOpenAI };

