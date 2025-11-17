const router = require('express').Router();
const verifyToken = require('../middleware/auth');
const QuizItem = require('../models/QuizItem');
const Mistake = require('../models/Mistake'); // Mistake 모델 추가 (삭제 시 필요)
const { buildQuizFromMistakes, updateSRS } = require('../services/quizService');

// ✨ [추가] quizService.js와 동일한 정규화 함수 (중복 제거 시 필요)
function norm(s){ return String(s||'').trim().replace(/\s+/g,' '); }

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
    
    const allDueItems = await QuizItem.find({ userId: uid, dueAt: { $lte: now } })
      .sort({ dueAt: 1 }) 
      .lean();

    const uniqueItemsMap = new Map();
    for (const item of allDueItems) {
        const normalizedPrompt = norm(item.prompt).toLowerCase();
        if (!uniqueItemsMap.has(normalizedPrompt)) {
            uniqueItemsMap.set(normalizedPrompt, item);
        }
    }
    
    const uniqueItems = Array.from(uniqueItemsMap.values()).slice(0, 10);

    res.json(uniqueItems);
  } catch (e) { next(e); }
});

function canon(s){
  return String(s || '')
   .toLowerCase()
   .replace(/[^\p{L}\p{N}\s']/gu, '')
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

    if (typeof userAnswer === 'string') {
      correct = isClose(userAnswer, it.answer);
    } else {
      correct = (Number(userAnswer) === it.correctIndex);
    }

    const grade = correct ? 5 : 2;
    const updated = await updateSRS(it._id, grade);

    res.json({
      ok: true,
      correct,
      expected: it.answer,
      explanation: it.explanation || '',
      nextDueAt: updated?.dueAt
    });

    
  } catch (e) { next(e); }
});

// 문제 삭제 (QuizItem과 Mistake 모두 삭제)
router.delete('/item/:id', verifyToken, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { id } = req.params; 

    const quizItemToDelete = await QuizItem.findOne({ _id: id, userId: uid });

    if (!quizItemToDelete) {
      return res.json({ ok: true, deleted: 0, message: 'Quiz item not found or already deleted.' });
    }

    const mistakeIds = quizItemToDelete.sourceMistakeIds;
    if (mistakeIds && mistakeIds.length > 0) {
      await Mistake.deleteMany({
        _id: { $in: mistakeIds },
        userId: uid 
      });
    }

    const result = await QuizItem.deleteOne({ _id: id, userId: uid });
    
    console.log(`[Quiz Delete] QuizItem ${id} and ${mistakeIds?.length || 0} mistake(s) deleted.`);
    res.json({ ok: true, deleted: result.deletedCount });
  } catch (e) { next(e); }
});


module.exports = router;

