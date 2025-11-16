const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const Mistake = require("./models/Mistake");

const GRAMMAR_CHECK_MODEL = "gpt-4o-mini";

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[.,!?'"’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function getCorrectionFromGPT(userMessage, languageCode) {
  const languageMap = {
    "en-US": "English",
    "ja-JP": "Japanese",
  };
  const targetLanguage = languageMap[languageCode] || "English";

  const systemPrompt = `
You are an expert language tutor. Your task is to analyze a user's sentence, correct ONLY the single most critical grammatical error, and provide a simple explanation in Korean.

RULES:
1.  **Minimal Correction:** Correct only one major grammatical mistake. DO NOT change the user's vocabulary, phrasing, or sentence structure.
2.  **Preserve Meaning:** The meaning of the corrected sentence must be identical to the original.
3.  **Ignore Style:** IGNORE minor stylistic issues like missing commas, capitalization, or punctuation (question marks, periods). Focus on clear grammatical errors (e.g., verb tense, subject-verb agreement, prepositions).
4.  **JSON Output:** You MUST respond in the following JSON format. Do not add any text outside the JSON structure.
    {
      "is_correct": boolean,
      "corrected_sentence": "The corrected full sentence, or the original sentence if no errors were found.",
      "explanation_korean": "A concise and friendly explanation of the error in Korean. If no error, this should be an empty string."
    }
`.trim();

  const userPrompt = `
Analyze the following sentence:
Language: ${targetLanguage}
Sentence: "${userMessage}"
`.trim();

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GRAMMAR_CHECK_MODEL,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
        const errorBody = await res.text();
        console.error(`[GPT Grammar Check] API Error ${res.status}:`, errorBody);
        return null;
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;

    return JSON.parse(content);
  } catch (e) {
    console.error("[GPT Grammar Check] Failed to get or parse GPT response:", e.message);
    return null;
  }
}

async function saveMistakeIfNotExists(userId, original, corrected, explanation) {
  try {
    const existing = await Mistake.findOne({ userId, original });
    if (existing) {
      console.log(`[GrammarChecker] Duplicate mistake found for user ${userId}, skipping save.`);
      return;
    }
    
    await Mistake.create({ userId, original, corrected, explanation });
    console.log(`[GrammarChecker] New mistake saved for user ${userId}.`);
  } catch (e) {
    console.error("[GrammarChecker] saveMistake error:", e.message);
  }
}

async function checkGrammar(userId, userMessage, languageCode) {
  console.log(`--- [New Grammar Check Start] User: ${userId}, Message: "${userMessage}" ---`);
  
  const result = await getCorrectionFromGPT(userMessage, languageCode);

  if (!result || result.is_correct || !result.corrected_sentence || !result.explanation_korean) {
    console.log("--- [New Grammar Check End] No significant error found or API failed. ---");
    return;
  }

  const originalNormalized = normalizeText(userMessage);
  const correctedNormalized = normalizeText(result.corrected_sentence);

  if (originalNormalized === correctedNormalized) {
    console.log("--- [New Grammar Check End] Change is only capitalization/punctuation. Ignoring. ---");
    return; 
  }
  
  if (userMessage.toLowerCase().trim() === result.corrected_sentence.toLowerCase().trim()) {
      console.log("--- [New Grammar Check End] Correction is identical to original (case-insensitive). ---");
      return;
  }

  await saveMistakeIfNotExists(
    userId,
    userMessage,
    result.corrected_sentence,
    result.explanation_korean
  );
  
  console.log("--- [New Grammar Check End] Genuine mistake processed. ---");
}

module.exports = { checkGrammar };

