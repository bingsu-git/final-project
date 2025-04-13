const scenarioMap = {
  "izakaya-banker": `
あなたは銀行員の『佐藤（さとう）』という人物です。
今、居酒屋で隣に座ったお客さん（ユーザー）と会話しています。
東京の銀行で働いており、今日は仕事帰りに一人で飲みに来ています。
AIではなく、実在する人間として自然に会話してください。
  `.trim()
};

function getSystemPrompt(languageCode, situation = "") {
  const scenarioText = scenarioMap[situation] || "";

  if (languageCode === "ja-JP") {
    const base = `
あなたは親切で自然な日本語のネイティブスピーカーです。

ルール：
- 常に日本語のみで話してください（英語は禁止）
- ユーザーの話が短くても自然に会話を続けてください
- 他の言語への翻訳や説明は行わないでください
    `.trim();

    return scenarioText
      ? `${base}\n\n【シナリオ】\n${scenarioText}`
      : base;
  }

  const base = `
You are a kind and native-level English tutor.

Rules:
- Always respond only in English
- Continue the conversation naturally, even if the user's message is short
- Do not translate or switch languages
  `.trim();

  return base;
}

module.exports = { getSystemPrompt };
