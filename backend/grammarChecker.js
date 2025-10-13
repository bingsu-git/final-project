// backend/grammarChecker.js
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const Mistake = require("./models/Mistake");

/* =========================
   DB 저장 헬퍼 (중복 방지)
   ========================= */
async function saveMistake(userId, original, corrected, explanation) {
  try {
    // 동일 사용자·원문·교정문 중복 저장 방지
    const existing = await Mistake.findOne({ userId, original, corrected });
    if (existing) {
      console.log("[grammarChecker] duplicate mistake, skip save");
      return existing;
    }
    const doc = await Mistake.create({ userId, original, corrected, explanation });
    return doc;
  } catch (e) {
    console.error("[grammarChecker] saveMistake error:", e.message);
  }
}

/* =========================
   GPT 한국어 친절 설명
   ========================= */
async function getKoreanExplanationFromGPT(original, corrected, technicalExplanation) {
  const systemPrompt =
    "당신은 친절하고 격려하는 한국어 튜터입니다. 사용자가 한 문장의 문법 오류를 쉽게 이해하도록 간단하고 명확한 한국어 설명만 제시하세요. 불필요한 형식은 배제하세요.";
  const userPrompt = `
다음은 사용자가 만든 문장 오류입니다. 아래 정보를 참고하여 '친절한 한국어 설명'만 작성하세요.

- 사용자의 원문: "${original}"
- 올바른 문장: "${corrected}"
- 기술적 설명(참고용): "${technicalExplanation}"

주의:
- 위의 기술적 설명을 그대로 복사하지 말고, 쉬운 표현으로 설명하세요.
- 출력에는 설명 문장만 포함하세요.
  `.trim();

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4",
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text || "문법 오류가 있지만, 설명을 생성하는 데 실패했습니다.";
  } catch (e) {
    console.error("[grammarChecker] GPT explanation error:", e.message);
    // 실패 시 기술적 설명이라도 반환
    return technicalExplanation || "설명을 생성하는 데 실패했습니다.";
  }
}

/* =========================
   하이브리드 문법 검사
   1) 자체 패턴(Flask)
   2) LanguageTool
   3) GPT 한국어 설명
   ========================= */
async function checkGrammarHybrid(userId, userMessage, languageCode) {
  console.log("\n--- [GrammarChecker 시작] ---");
  console.log("[Input] 사용자 메시지:", JSON.stringify(userMessage));

  /* -------- 1단계: Flask 패턴 분석기 -------- */
  try {
    console.log("[1단계] 패턴 분석기 호출 시작...");
    const flaskRes = await fetch("http://localhost:5001/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: userMessage }),
    });
    const result = await flaskRes.json().catch(() => ({}));
    console.log("[1단계] 패턴 분석기 응답:", JSON.stringify(result, null, 2));

    if (result?.patterns?.length > 0) {
      console.log("✅ [1단계] 패턴 분석기에서 오류 발견 → 우선 저장");
      const p = result.patterns[0];
      await saveMistake(userId, userMessage, userMessage, p.explanation || "패턴 기반 오류로 감지됨");
      // 패턴 감지가 있으면 여기서 종료해도 되고, LT로 추가 확인할 수도 있다.
      // 중복 저장을 피하기 위해 패턴에서 바로 return 한다.
      return;
    }
    console.log("[1단계] 패턴 없음. 2단계로 진행.");
  } catch (err) {
    console.error("❌ [1단계] 패턴 분석기 연결 실패:", err.message);
  }

  /* -------- 2단계: LanguageTool -------- */
  const toolLanguageCode = languageCode === "ja-JP" ? "ja" : languageCode;
  const payload = new URLSearchParams({
    text: userMessage,
    language: toolLanguageCode || "en",
    disabledRules: "UPPERCASE_SENTENCE_START", // 문장 대문자 강제 규칙 비활성화
  }).toString();

  try {
    console.log("[2단계] LanguageTool 호출 시작...");
    const ltRes = await fetch("https://api.languagetool.org/v2/check", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload,
    });
    const lt = await ltRes.json();
    console.log("[2단계] LanguageTool 응답:", JSON.stringify(lt, null, 2));

    if (Array.isArray(lt.matches) && lt.matches.length > 0) {
      console.log("✅ [2단계] LanguageTool에서 오류 발견!");

      // 가장 첫 오류 기준으로 전체 문장 재구성
      const err = lt.matches[0];
      const replacement = err?.replacements?.[0]?.value || null;
      const offset = Number.isInteger(err?.offset) ? err.offset : null;
      const length = Number.isInteger(err?.length) ? err.length : null;

      // 기본값은 원문 그대로
      let correctedFull = userMessage;

      if (replacement && offset !== null && length !== null && offset >= 0 && length >= 0 && offset + length <= userMessage.length) {
        // 정확한 위치 치환
        correctedFull =
          userMessage.slice(0, offset) + replacement + userMessage.slice(offset + length);
      } else if (replacement) {
        // 폴백: 가장 간단한 토큰 기반 1회 치환 시도
        // (LanguageTool이 context.text를 줄 때가 있어 활용)
        const token = (err?.context?.text || "").trim();
        if (token) {
          const re = new RegExp("\\b" + token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
          correctedFull = userMessage.replace(re, replacement);
        } else {
          // 마지막 폴백: 흔한 케이스 가벼운 교체 예시(영어 have/has 등)
          correctedFull = userMessage.replace(/\bhave\b/i, replacement);
        }
      }

      // 교정 결과가 원문과 동일하면 저장하지 않음
      if (userMessage.trim() === correctedFull.trim()) {
        console.log("[2단계] 교정 결과가 원문과 동일. 저장하지 않음.");
        return;
      }

      // 3단계: GPT로 친절한 한국어 설명 생성
      console.log("[3단계] GPT 한국어 설명 생성 시작...");
      const finalExplanation = await getKoreanExplanationFromGPT(
        userMessage,
        correctedFull,
        err?.message || "문법 오류가 감지되었습니다."
      );
      console.log("[3단계] GPT 설명 완료:", finalExplanation);

      // 전체 문장으로 Mistake 저장
      await saveMistake(userId, userMessage, correctedFull, finalExplanation);
      console.log("--- [GrammarChecker 종료] 저장 완료 ---");
      return;
    }

    console.log("--- [GrammarChecker 종료] LT 오류 없음 ---");
  } catch (error) {
    console.error("❌ [2단계] LanguageTool API 오류:", error.message);
  }
}

module.exports = { checkGrammarHybrid };
