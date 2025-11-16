const Mistake = require('../models/Mistake');
const QuizItem = require('../models/QuizItem');

/* ── 공통 유틸 ─────────────────────────────────────────────── */
function norm(s){ return String(s||'').trim().replace(/\s+/g,' '); }

function calculateEditDistance(a, b) {
  const s1 = norm(a).toLowerCase();
  const s2 = norm(b).toLowerCase();
  const dp = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
  for (let i = 0; i <= s1.length; i += 1) { dp[0][i] = i; }
  for (let j = 0; j <= s2.length; j += 1) { dp[j][0] = j; }
  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[j][i] = Math.min(
        dp[j][i - 1] + 1,       // Deletion
        dp[j - 1][i] + 1,       // Insertion
        dp[j - 1][i - 1] + indicator, // Substitution
      );
    }
  }
  return dp[s2.length][s1.length];
}

function isHighQualityMistake(original, corrected) {
  const o = norm(original);
  const c = norm(corrected);
  if (!o || !c || o.toLowerCase() === c.toLowerCase()) {
    return false;
  }
  const oTokens = o.split(' ').length;
  const cTokens = c.split(' ').length;
  if (Math.abs(oTokens - cTokens) > 2) {
    return false;
  }
  const maxLength = Math.max(o.length, c.length);
  if (maxLength > 10) {
    const distance = calculateEditDistance(o, c);
    if (distance / maxLength > 0.4) {
      return false;
    }
  }
  if (cTokens < 2) {
    return false;
  }
  return true;
}

function buildRewriteQuiz(userId, mistake) {
  return {
    userId,
    type: 'rewrite',
    language: mistake.language || 'en',
    stem: '다음 문장을 문법에 맞게 올바르게 고쳐주세요.',
    prompt: norm(mistake.original),
    answer: norm(mistake.corrected),
    sourceMistakeIds: [mistake._id],
    patternKey: mistake.patternKey || (mistake.explanation || '').slice(0, 50),
    explanation: mistake.explanation || ''
  };
}

/* ── Mistake → QuizItem 생성 (핵심 로직) ──────────────────────────────── */
async function buildQuizFromMistakes(userId, { total = 10 } = {}) {
  const mistakes = await Mistake.find({ userId }).sort({ createdAt: -1 }).lean();
  if (!mistakes.length) return [];

  const validMistakes = mistakes.filter(m => isHighQualityMistake(m.original, m.corrected));
  if (!validMistakes.length) return [];
  
  // ✨ [핵심 수정] ID 대신 '퀴즈 내용(prompt)'을 기준으로 중복을 제거합니다.
  // 1. DB에서 현재 사용자(userId)의 '모든' 퀴즈를 가져옵니다.
  const existingQuizzes = await QuizItem.find({ userId }).lean();

  // 2. 이 퀴즈들의 '문제 내용(prompt)'을 정규화(소문자/공백정리)하여 Set에 저장합니다.
  //    예: "she have a dog"
  const existingQuizPrompts = new Set(
    existingQuizzes.map(q => norm(q.prompt).toLowerCase())
  );

  // 3. 'validMistakes' 목록을 순회하면서, 
  //    'Mistake의 원본 텍스트'가 'existingQuizPrompts' Set에 *없는* 것만 필터링합니다.
  const newMistakes = validMistakes.filter(m => 
    !existingQuizPrompts.has(norm(m.original).toLowerCase())
  );
  // --- [수정 1 끝] ---

  if (!newMistakes.length) return []; // 새로 만들 퀴즈가 없음

  // ✨ [핵심 수정] 새로 만들 퀴즈 목록(newMistakes) 안에서도 중복이 있을 수 있으므로,
  // 4. Map을 이용해 다시 한번 '내용' 기준으로 중복을 제거합니다.
  const uniqueMistakesMap = new Map();
  for (const mistake of newMistakes) { // 'newMistakes' 배열 사용
    const normalizedKey = norm(mistake.original).toLowerCase();
    if (!uniqueMistakesMap.has(normalizedKey)) {
      uniqueMistakesMap.set(normalizedKey, mistake);
    }
  }
  const uniqueNewMistakes = Array.from(uniqueMistakesMap.values());
  // --- [수정 2 끝] ---

  const pickedMistakes = uniqueNewMistakes.slice(0, total); // 중복이 완벽히 제거된 목록
  const quizItemsToCreate = pickedMistakes.map(mistake => buildRewriteQuiz(userId, mistake));

  if (!quizItemsToCreate.length) return [];
  
  const created = await QuizItem.insertMany(quizItemsToCreate);
  return created;
}

/* ── SRS 업데이트 ────────────────────────────────────────── */
async function updateSRS(itemId, grade /* 0~5 */) {
  const it = await QuizItem.findById(itemId);
  if (!it) return null;
 // ... (이하 동일)
  let { reps, ef, interval } = it;
  if (grade >= 3) {
    if (reps === 0) interval = 1;
    else if (reps === 1) interval = 3;
    else interval = Math.round(interval * ef);
    reps += 1;
    ef = Math.max(1.3, ef + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
  } else {
    reps = 0; interval = 1;
  }
  const dueAt = new Date(Date.now() + interval * 86400000);
  Object.assign(it, { reps, ef, interval, dueAt });
  await it.save();
  return it;
}

module.exports = { buildQuizFromMistakes, updateSRS };

