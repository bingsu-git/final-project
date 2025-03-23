const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function getGPTResponse(message) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "너는 외국어를 가르쳐주는 친절한 AI 선생님이야." },
        { role: "user", content: message },
      ],
    }),
  });

  const data = await response.json();
  console.log("GPT 응답 전체:", data); // 👈 여기!

  if (data && data.choices && data.choices.length > 0) {
    return data.choices[0].message.content;
  } else {
    return "GPT 응답을 처리할 수 없습니다. 다시 시도해 주세요.";
  }
}

module.exports = { getGPTResponse };