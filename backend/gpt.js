const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const User = require("./models/User");
const Mistake = require("./models/Mistake");
const { getSystemPrompt } = require("./prompts");

async function getGPTResponse(message, languageCode = "ja-JP", sessionId = "", situation = "") {
  const systemPrompt = getSystemPrompt(languageCode, situation);

  let user = await User.findOne({ userId: sessionId });
  if (!user) {
    user = await User.create({
      userId: sessionId,
      languageCode,
      chatHistory: [],
    });
  }

  const messages = [
    { role: "system", content: systemPrompt },
    ...user.chatHistory,
    { role: "user", content: message }
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4",
      temperature: 0.2,
      messages,
    }),
  });

  const data = await response.json();
  const reply = data?.choices?.[0]?.message?.content?.trim();

  if (reply) {
    user.chatHistory.push({ role: "user", content: message });
    user.chatHistory.push({ role: "assistant", content: reply });
    await user.save();

    await checkAndSaveMistake(sessionId, message);
    return reply;
  }

  return "GPT 응답을 처리할 수 없습니다。";
}

async function checkAndSaveMistake(userId, userMessage) {
  const correctionPrompt = `
너는 사용자의 문장이 **자연스러운 말하기 표현**인지 확인하는 전문가야.
말로 하는 표현이므로 문장부호나 대문자 사용은 신경 쓰지 마.

입력한 문장이 자연스러우면:
결과: 정상

수정이 필요하면:
결과: 수정 필요  
수정 제안: (자연스러운 말로 고쳐서 제안)  
설명: (간단한 이유 설명)

❌ 문장 끝 마침표, 첫 단어 대문자, 구두점은 고치지 마.  
✅ 발음, 단어 순서, 어색한 표현만 교정해.
  `.trim();

  const correctionResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4",
      temperature: 0,
      messages: [
        { role: "system", content: correctionPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  const data = await correctionResponse.json();
  const feedback = data?.choices?.[0]?.message?.content?.trim();

  if (!feedback || feedback.includes("정상")) return;

  const correctedMatch = feedback.match(/수정 제안:\s*(.+)/);
  const explanationMatch = feedback.match(/설명:\s*(.+)/);

  const corrected = correctedMatch ? correctedMatch[1].trim() : "";
  const explanation = explanationMatch ? explanationMatch[1].trim() : "";

  if (corrected) {
    await Mistake.create({
      userId,
      original: userMessage,
      corrected,
      explanation
    });
  }
}

module.exports = { getGPTResponse };