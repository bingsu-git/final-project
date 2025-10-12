const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const User = require("./models/User");
const Mistake = require("./models/Mistake");
const { getSystemPrompt } = require("./prompts");

// --- ✨ 수정된 부분: difficulty 파라미터 추가 ---
async function getGPTResponse(message, languageCode = "ja-JP", sessionId = "", situation = "", difficulty = "medium") {
  // --- ✨ 수정된 부분: difficulty 전달 ---
  const systemPrompt = getSystemPrompt(languageCode, situation, difficulty);

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
    
    // --- ✨ 수정된 부분: languageCode를 문법 검사 함수에 전달 ---
    await checkAndSaveMistake(sessionId, message, languageCode);
    return reply;
  }

  return "GPT 응답을 처리할 수 없습니다。";
}

// --- ✨ 수정된 부분: 언어에 따라 동적으로 프롬프트를 생성하도록 전체 함수 수정 ---
async function checkAndSaveMistake(userId, userMessage, languageCode) {
  let correctionPrompt;

  // 영어 학습자를 위한 프롬프트
  if (languageCode === 'en-US') {
    correctionPrompt = `
You are an expert who ONLY corrects grammatical errors in the user's sentence. The user is a Korean speaker.

👉 Rules you MUST follow:
✅ Do not change the meaning (no adding/deleting/replacing words).
✅ Do not change word choices (no synonyms).
✅ Only fix grammatical errors.
✅ This is spoken language, so do NOT correct punctuation like periods, commas, question marks.
✅ Do not change the capitalization of the first word.
✅ Do not explain anything about punctuation.

If the input sentence is grammatically correct and natural:
Result: OK

If there is a grammatical error:
Result: Needs correction
Suggestion: (Provide the grammatically corrected sentence. Do NOT change meaning/words.)
Explanation: (Provide a simple explanation of the grammatical error IN KOREAN for the user to understand.)
    `.trim();
  } 
  // 일본어 학습자를 위한 프롬프트
  else if (languageCode === 'ja-JP') {
    correctionPrompt = `
あなたはユーザーの文章から**文法的な間違いのみを修正する専門家**です。ユーザーは韓国語話者です。

👉 必ず守るべきルール:
✅ 意味を変えないこと（単語の追加・削除・置換の禁止）。
✅ 単語の選択を変えないこと（類義語の使用禁止）。
✅ 文法的な間違いのみを修正すること。
✅ 話し言葉なので、文末の句点、読点、疑問符などの**句読点は修正しないでください**。
✅ 最初の単語の大文字/小文字を変更しないでください。
✅ 句読点に関する説明はしないでください。

入力された文章が文法的に自然な場合:
結果: OK

文法的な間違いがある場合:
結果: 修正が必要です
修正提案: (文法のみを修正して提案。意味/単語は絶対に変えないこと。)
説明: (簡単な文法の間違いの説明を**韓国語で**作成してください。)
    `.trim();
  } 
  // 지원하지 않는 언어의 경우 함수 종료
  else {
    return;
  }

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

  // 'OK' 또는 '정상' 이라는 단어가 포함된 경우 피드백을 저장하지 않음 (더 유연하게)
  if (!feedback || feedback.includes("OK") || feedback.includes("정상")) return;

  // 결과 파싱 (영문/일본어 프롬프트 모두 호환되도록 수정)
  const correctedMatch = feedback.match(/(?:Suggestion|修正提案):\s*(.+)/);
  const explanationMatch = feedback.match(/(?:Explanation|説明):\s*(.+)/);

  const corrected = correctedMatch ? correctedMatch[1].trim() : "";
  const explanation = explanationMatch ? explanationMatch[1].trim() : "";

  if (corrected) {
    console.log("[DEBUG] Mistake.create 실행!", {
      userId, original: userMessage, corrected, explanation
    });
    await Mistake.create({
      userId,
      original: userMessage,
      corrected,
      explanation
    });
  }
}

module.exports = { getGPTResponse };

