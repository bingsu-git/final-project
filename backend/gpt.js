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
        {
          role: "system",
          content: `
        You are a friendly native speaker who talks like a real human.
        Speak naturally, just like how people talk in daily life.
        Use contractions (like I'm, you're), emojis sometimes, and express emotions.
        Avoid sounding robotic or like a textbook.
        ${levelDescription}
        Reply in ${languageCode}.
        👉 Also, match the user's tone: 
        You must strictly follow the user's speech tone.
        If the user uses polite Korean (존댓말), always respond politely.
        If the user uses informal Korean (반말), always respond informally.
        Do not mix tones in a single response.
          `.trim()
        },
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