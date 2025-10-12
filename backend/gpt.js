const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const User = require("./models/User");
const { getSystemPrompt } = require("./prompts");
const { checkGrammarHybrid } = require('./grammarChecker');

// AI에게 전달할 대화 기록의 최대 개수 (Sliding Window)
const CONTEXT_WINDOW_SIZE = 20;

async function getGPTResponse(message, languageCode = "ja-JP", sessionId = "", situation = "", difficulty = "medium") {
  // ... (이 함수의 상단 내용은 이전과 동일합니다) ...
  const systemPrompt = getSystemPrompt(languageCode, situation, difficulty);
  
  // ... (사용자 정보 찾거나 생성하는 부분 생략) ...
  let user = await User.findOne({ userId: sessionId });
  if (!user) {
    user = await User.create({
      userId: sessionId,
      languageCode,
      chatHistory: [],
    });
  }

  // ... (최근 대화 기록 잘라내는 부분 생략) ...
  const recentHistory = user.chatHistory.slice(-CONTEXT_WINDOW_SIZE);

  const messages = [
    { role: "system", content: systemPrompt },
    ...recentHistory,
    { role: "user", content: message }
  ];

  // ... (OpenAI API 요청 부분 생략) ...
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4",
      temperature: 0.2, // AI의 창의성을 낮춰 일관된 답변 유도
      messages,
    }),
  });


  const data = await response.json();
  const reply = data?.choices?.[0]?.message?.content?.trim();

  if (reply) {
    // 4. 새로운 대화를 DB에 저장합니다.
    user.chatHistory.push({ role: "user", content: message });
    user.chatHistory.push({ role: "assistant", content: reply });
    await user.save();
    
    // --- ✨ 수정된 부분: try...catch를 제거하여 오류를 다시 확인합니다 ---
    await checkGrammarHybrid(sessionId, message, languageCode);
    
    return reply;
  }

  return "GPT 응답을 처리할 수 없습니다。";
}

module.exports = { getGPTResponse };

