const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { getSystemPrompt } = require("./prompts");
const User = require("./models/User");

async function getGPTResponse(message, languageCode = "en-US", sessionId = "") {
  const systemPrompt = getSystemPrompt(languageCode);

  // 사용자 불러오기 or 생성
  let user = await User.findOne({ userId: sessionId });
  if (!user) {
    user = await User.create({ userId: sessionId, languageCode, chatHistory: [] });
  }

  // 메시지 구성
  const messages = [
    { role: "system", content: systemPrompt },
    ...user.chatHistory,
    { role: "user", content: message }
  ];

  // GPT 호출
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      temperature: 0.2,
      messages,
    }),
  });

  const data = await res.json();
  const reply = data?.choices?.[0]?.message?.content?.trim();

  // 저장 후 응답
  if (reply) {
    user.chatHistory.push({ role: "user", content: message });
    user.chatHistory.push({ role: "assistant", content: reply });
    await user.save();
    return reply;
  }

  return "GPT 응답을 처리할 수 없습니다.";
}

module.exports = { getGPTResponse };
