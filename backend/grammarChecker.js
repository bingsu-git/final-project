const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const Mistake = require("./models/Mistake");

// 헬퍼: DB에 실수 저장
async function saveMistake(userId, original, corrected, explanation) {
  // 이미 같은 실수가 저장되어 있는지 확인 (중복 방지)
  const existingMistake = await Mistake.findOne({ userId, original, corrected });
  if (existingMistake) {
    console.log("[DEBUG] 중복된 실수이므로 저장하지 않습니다.");
    return;
  }

  console.log("[DEBUG] Mistake.create 실행!", { userId, original, corrected, explanation });
  await Mistake.create({ userId, original, corrected, explanation });
}

// AI를 이용해 친절한 한국어 설명 생성
async function getKoreanExplanationFromGPT(original, corrected, technicalExplanation) {
  const systemPrompt = "You are a friendly and encouraging language tutor who speaks Korean. Your task is to explain a single grammatical error to a user in a simple, clear, and friendly manner.";
  
  const userPrompt = `
Here is a grammatical error a user made. Please explain it to them.

- User's original sentence: "${original}"
- Corrected sentence: "${corrected}"
- Technical reason for the correction: "${technicalExplanation}"

Please provide ONLY the friendly explanation in Korean, without including the technical details above in your response.
  `.trim();

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4",
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
      }),
    });
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || "문법 오류가 있지만, 설명을 생성하는 데 실패했습니다.";
  } catch (error) {
    console.error("GPT Explanation Error:", error);
    return technicalExplanation; // GPT 실패 시 기술적 설명이라도 반환
  }
}


// ✨ 핵심: 하이브리드 문법 검사 함수
async function checkGrammarHybrid(userId, userMessage, languageCode) {
  console.log("--- [GrammarChecker 시작] ---");
  console.log(`[Input] 사용자 메시지: "${userMessage}"`);

  // --- 1단계: 자체 패턴 분석기 실행 ---
  try {
    console.log("[1단계] 패턴 분석기 호출 시작...");
    const flaskRes = await fetch("http://localhost:5001/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: userMessage }),
    });
    const result = await flaskRes.json();
    console.log("[1단계] 패턴 분석기 응답:", JSON.stringify(result, null, 2));

    if (result.patterns && result.patterns.length > 0) {
      console.log("✅ [1단계] 패턴 분석기에서 오류 발견!");
      const p = result.patterns[0];
      await saveMistake(userId, userMessage, "", p.explanation);
      return;
    }
    console.log("[1단계] 패턴 없음. 2단계로 진행.");
  } catch (err) {
    console.error("❌ [1단계] 패턴 분석기 연결 실패:", err.message);
  }

  // --- 2단계: LanguageTool API 실행 ---
  const toolLanguageCode = languageCode === 'ja-JP' ? 'ja' : languageCode;
  const encodedText = new URLSearchParams({ 
    text: userMessage, 
    language: toolLanguageCode,
    disabledRules: 'UPPERCASE_SENTENCE_START' 
  }).toString();
  try {
    console.log("[2단계] LanguageTool API 호출 시작...");
    const response = await fetch("https://api.languagetool.org/v2/check", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: encodedText,
    });
    const data = await response.json();
    console.log("[2단계] LanguageTool 응답:", JSON.stringify(data, null, 2));


    if (data.matches && data.matches.length > 0) {
      console.log("✅ [2단계] LanguageTool에서 오류 발견!");
      const error = data.matches[0];
      const corrected = error.replacements[0]?.value || userMessage;
      
      if (userMessage.trim() === corrected.trim()) {
        console.log("[2단계] 교정된 내용이 원문과 동일하여 종료.");
        return;
      }

      // --- 3단계: GPT로 친절한 설명 만들기 ---
      console.log("[3단계] GPT 설명 생성 시작...");
      const finalExplanation = await getKoreanExplanationFromGPT(userMessage, corrected, error.message);
      console.log("[3단계] GPT 설명 생성 완료:", finalExplanation);
      
      await saveMistake(userId, userMessage, corrected, finalExplanation);
      return;
    }
  } catch (error) {
    console.error("❌ [2단계] LanguageTool API 오류:", error.message);
  }

  console.log("--- [GrammarChecker 종료] 문법 오류 없음. ---");
}

module.exports = { checkGrammarHybrid };

