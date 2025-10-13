const router = require('express').Router();
const verifyToken = require('../middleware/auth');
const QuizItem = require('../models/QuizItem');
const { buildQuizFromMistakes, updateSRS } = require('../services/quizService');

router.get('/ping', (_req, res) => res.json({ ok: true, where: 'quiz-router' }));

router.post('/generate', verifyToken, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { total = 10 } = req.body || {};
    const items = await buildQuizFromMistakes(uid, { total });
    res.json({ ok: true, count: items.length });
  } catch (e) { next(e); }
});

router.get('/due', verifyToken, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const now = new Date();
    const items = await QuizItem.find({ userId: uid, dueAt: { $lte: now } })
      .sort({ dueAt: 1 })
      .limit(10)
      .lean();
    res.json(items);
  } catch (e) { next(e); }
});

/* ===== 텍스트 입력 채점 지원 ===== */
function canon(s){
 // 유니코드 단어/숫자/' 만 남기고 문장부호 제거, 소문자, 공백 정리
 return String(s || '')
   .toLowerCase()
   .replace(/[^\p{L}\p{N}\s']/gu, '')   // .,!?;:"- 등 제거
   .replace(/\s+/g, ' ')
   .trim();
}
 function editDistance(a,b){
  a = canon(a); b = canon(b);
  const dp = Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
  for (let i=0;i<=a.length;i++) dp[i][0]=i;
  for (let j=0;j<=b.length;j++) dp[0][j]=j;
  for (let i=1;i<=a.length;i++){
    for (let j=1;j<=b.length;j++){
      const cost = a[i-1]===b[j-1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost);
    }
  }
  return dp[a.length][b.length];
}
function isClose(a,b){
  const d = editDistance(a,b);
  const L = Math.max(canon(a).length, canon(b).length);
  if (L <= 4) return d === 0;
  return d <= 1 || (L >= 8 && d <= 2);
}

router.post('/answer', verifyToken, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { itemId, userAnswer } = req.body;

    const it = await QuizItem.findOne({ _id: itemId, userId: uid });
    if (!it) return res.status(404).json({ ok: false, error: 'not_found' });

  // 불량 카드(정답이 비어 있음)는 자동 통과 + invalid 플래그
  if (!it.answer || !String(it.answer).trim()) {
    const updated = await updateSRS(it._id, 5);
    return res.json({
      ok: true, correct: true, invalid: true,
      expected: it.answer || "",
      explanation: it.explanation || "",
      nextDueAt: updated?.dueAt
    });
  }

    let correct = false;

    // 문자열로 오면 "텍스트 입력형"으로 채점 (타입이 mcq라도 허용)
    if (typeof userAnswer === 'string') {
      correct = isClose(userAnswer, it.answer);
    } else {
      // 숫자 인덱스가 오면 (구객관식)도 여전히 지원
      correct = (Number(userAnswer) === it.correctIndex);
    }

    const grade = correct ? 5 : 2;
    const updated = await updateSRS(it._id, grade);

    res.json({
      ok: true,
      correct,
      expected: it.answer,           // 프런트에서 정답 보여주기 용
      explanation: it.explanation || '',
      nextDueAt: updated?.dueAt
    });

    
  } catch (e) { next(e); }
});

// 문제 삭제
router.delete('/item/:id', verifyToken, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { id } = req.params;
    const r = await QuizItem.deleteOne({ _id: id, userId: uid });
    res.json({ ok: true, deleted: r.deletedCount });
  } catch (e) { next(e); }
});


module.exports = router;
