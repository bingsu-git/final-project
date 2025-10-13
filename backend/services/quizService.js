// backend/services/quizService.js
const Mistake = require('../models/Mistake');
const QuizItem = require('../models/QuizItem');

/* ── 공통 유틸 ─────────────────────────────────────────────── */
const MIN_LEN = 2;
function shuffle(a){ return a.map(v=>[Math.random(),v]).sort((x,y)=>x[0]-y[0]).map(x=>x[1]); }
function norm(s){ return String(s||'').trim().replace(/\s+/g,' '); }
function makePatternKey(m) {
  const base = (m.pattern || m.explanation || '').toLowerCase();
  return base.replace(/\W+/g, ' ').trim().slice(0, 80);
}
function qualityGuards(original, corrected) {
  const o = norm(original), c = norm(corrected);
  if (!c || c.length < 3) return false;
  if (o.toLowerCase() === c.toLowerCase()) return false;
  return true;
}

/* ── 클로즈/리라이트 보조 ─────────────────────────────────── */
const STOPWORDS_EN = new Set([
  "the","a","an","of","to","in","on","for","and","or","but","is","am","are",
  "was","were","be","been","being","that","this","it","at","by","from","as",
  "with","not","no","do","does","did"
]);

function pickContentWordEn(s) {
  const toks = s.split(/\s+/);
  let idx = -1, best = -1;
  toks.forEach((t, i) => {
    const low = t.toLowerCase().replace(/^[^\w]+|[^\w]+$/g,'');
    if (!low || low.length < MIN_LEN || STOPWORDS_EN.has(low)) return;
    if (low.length > best) { best = low.length; idx = i; }
  });
  if (idx < 0) idx = Math.max(0, Math.floor(toks.length/2));
  return { idx, toks };
}

function pickContentCharJa(s) {
  const arr = Array.from(s);
  let i = Math.floor(arr.length/2);
  let L=i, R=i;
  const isWord = ch => /[\u3040-\u30ff\u4e00-\u9faf]/.test(ch);
  while ((L>=0 || R<arr.length) && (L<0 || !isWord(arr[L])) && (R>=arr.length || !isWord(arr[R]))) {
    L--; R++;
  }
  const idx = (L>=0 && isWord(arr[L])) ? L : (R<arr.length ? R : i);
  return { idx, arr };
}

/* ── GPT 보기 생성(의미/수량 동일 + 최소 수정 강제) ─────────── */
async function gptDistractors({ language, original, corrected, pattern, explanation }) {
  const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
  const model = process.env.OPENAI_QUIZ_MODEL || "gpt-4o-mini";

  const sys = [
    "You are a high-quality language test item writer.",
    "Task: Given an ORIGINAL incorrect sentence and its CORRECTED sentence, create 5 plausible but incorrect alternatives for a multiple-choice item.",
    "STRICT constraints:",
    "- Keep the meaning, entities, and quantities EXACTLY the same as the corrected sentence.",
    "- Do NOT add or remove information (no new adjectives/nouns, no number changes like 'two', no big tense/subject changes unless it is the single error).",
    "- Each option must be a MINIMAL edit that introduces a typical grammar/usage error related to the user's pattern.",
    "- Do NOT output the original or the corrected sentence.",
    "- Keep similar length and word order; avoid single-word outputs.",
    "- Return ONLY a JSON array of 5 strings. No commentary."
  ].join("\n");

  const user = JSON.stringify({
    language,
    pattern,
    explanation,
    original,
    corrected
  });

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method:"POST",
    headers:{
      "Authorization":`Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type":"application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      messages: [
        { role:"system", content: sys },
        { role:"user", content: user }
      ]
    })
  });

  if (!r.ok) {
    const txt = await r.text().catch(()=> "");
    throw new Error(`OpenAI distractor error ${r.status}: ${txt}`);
  }

  const j = await r.json();
  const txt = j?.choices?.[0]?.message?.content?.trim() || "[]";
  let arr = [];
  try { arr = JSON.parse(txt); } catch { arr = []; }
  if (!Array.isArray(arr)) arr = [];

  // 1차 정제
  const raw = arr.map(s => norm(s)).filter(s => s && s.length >= 3);

  // 2차 필터: 의미/수량 변경 금지 + 최소 수정 휴리스틱
  const hasNumber = s => /\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b/i.test(s);
  const tokenDiffOk = (a, b) => {
    const at = a.toLowerCase().split(/\s+/), bt = b.toLowerCase().split(/\s+/);
    if (Math.abs(at.length - bt.length) > 1) return false;                 // 토큰 개수 차 과도 금지
    const A = new Set(at), B = new Set(bt);                                // 자카드 유사도
    const inter = [...A].filter(x => B.has(x)).length;
    const uni = new Set([...at, ...bt]).size;
    const jacc = inter / uni;
    return jacc >= 0.7;
  };
  const editDistance = (a,b)=>{
    a=a.toLowerCase(); b=b.toLowerCase();
    const dp = Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
    for(let i=0;i<=a.length;i++) dp[i][0]=i;
    for(let j=0;j<=b.length;j++) dp[0][j]=j;
    for(let i=1;i<=a.length;i++){
      for(let j=1;j<=b.length;j++){
        const cost = a[i-1]===b[j-1]?0:1;
        dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+cost);
      }
    }
    return dp[a.length][b.length];
  };

  const correctedN = norm(corrected).toLowerCase();
  const originalN  = norm(original).toLowerCase();

  const filtered = raw.filter(s => {
    const sn = s.toLowerCase();
    if (sn === correctedN) return false;                 // 정답 동일 금지
    if (sn === originalN) return false;                  // 원문 동일 금지
    if (hasNumber(s) && !hasNumber(corrected)) return false;  // 수량 추가/변경 금지
    if (!tokenDiffOk(s, corrected)) return false;        // 토큰/유사도 제약
    if (editDistance(s, corrected) > 4) return false;    // 과도한 수정 금지
    // 간단 복수화 억제 예시(필요시 케이스 추가 가능)
    if (!/\bdogs?\b/i.test(corrected) && /\bdogs\b/i.test(s)) return false;
    return true;
  });

  return filtered.slice(0,3); // 정확히 3개만
}

/* ── GPT 실패 시 폴백: 최소-편집 오답 ─────────────────────── */
function fallbackDistractors(corrected) {
  const c = norm(corrected);
  const outs = new Set();

  // 최소 형태 변형 위주(의미 변화 최소화)
  outs.add(c.replace(/\bhas\b/ig,'have'));
  outs.add(c.replace(/\bhave\b/ig,'has'));
  outs.add(c.replace(/\bdoes\b/ig,'do'));
  outs.add(c.replace(/\bdo\b/ig,'does'));
  outs.add(c.replace(/\bis\b/ig,'are'));
  outs.add(c.replace(/\bare\b/ig,'is'));

  // 전치사 흔한 혼동
  outs.add(c.replace(/\bon\b/ig,'in'));
  outs.add(c.replace(/\bin\b/ig,'on'));

  // 관사 교란
  outs.add(c.replace(/\ba\b/ig,'the'));
  outs.add(c.replace(/\bthe\b/ig,'a'));
  outs.add(c.replace(/\ban\b/ig,'a'));

  const uniq = Array.from(outs)
    .map(norm)
    .filter(s => s && s.toLowerCase() !== c.toLowerCase())
    .filter(s => Math.abs(s.split(/\s+/).length - c.split(/\s+/).length) <= 1);

  while (uniq.length < 3) uniq.push(c.replace(/\bhas\b/ig,'have'));
  return uniq.slice(0,3);
}

/* ── MCQ (GPT 전용 + 필터 + 폴백) ─────────────────────────── */
async function buildMCQ(userId, m, key) {
  const language = m.language || 'en';
  const stem = '다음 문장을 올바르게 고치세요.';
  const original = norm(m.original);
  const corrected = norm(m.corrected);

  let distractors = [];
  try {
    distractors = await gptDistractors({
      language,
      original,
      corrected,
      pattern: m.pattern || '',
      explanation: m.explanation || ''
    });
  } catch (e) {
    console.warn("[QUIZ] GPT distractors failed, fallback:", e.message);
  }
  if (!distractors || distractors.length < 3) {
    distractors = fallbackDistractors(corrected);
  }

  const options = shuffle([corrected, ...distractors]);
  const correctIndex = options.findIndex(o => o === corrected);

  return {
    userId, type:'mcq', language,
    stem, prompt: original,
    options, correctIndex,
    answer: corrected,
    sourceMistakeIds:[m._id], patternKey:key,
    explanation: m.explanation || ''
  };
}

/* ── Cloze / Rewrite (품질 가드 유지) ─────────────────────── */
function buildCloze(userId, m, key) {
  const language = m.language || 'en';
  const corrected = norm(m.corrected);
  if (language.startsWith('ja')) {
    const { idx, arr } = pickContentCharJa(corrected);
    const ans = arr[idx];
    arr[idx] = '＿';
    return {
      userId, type:'cloze', language,
      stem:'빈칸에 들어갈 가장 적절한 글자를(어절) 쓰세요.',
      prompt: arr.join(''),
      answer: ans,
      sourceMistakeIds:[m._id], patternKey:key,
      explanation: m.explanation || ''
    };
  } else {
    const { idx, toks } = pickContentWordEn(corrected);
    const ans = toks[idx];
    toks[idx] = '_____';
    return {
      userId, type:'cloze', language,
      stem:'빈칸에 들어갈 가장 적절한 단어를 쓰세요.',
      prompt: toks.join(' '),
      answer: ans,
      sourceMistakeIds:[m._id], patternKey:key,
      explanation: m.explanation || ''
    };
  }
}

function buildRewrite(userId, m, key) {
  const language = m.language || 'en';
  return {
    userId, type:'rewrite', language,
    stem:'다음 문장을 올바르게 고치세요.',
    prompt: norm(m.original),
    answer: norm(m.corrected),
    sourceMistakeIds:[m._id], patternKey:key,
    explanation: m.explanation || ''
  };
}

/* ── 패턴 스코어링(빈도+최신성) ─────────────────────────── */
function scoreGroup(arr){
  return arr.slice(0,5).length*2 + Math.max(0, arr.length-5)*1;
}

/* ── Mistake → QuizItem 생성 ──────────────────────────────── */
async function buildQuizFromMistakes(userId, { limitPerPattern = 2, total = 10 } = {}) {
  const mistakes = await Mistake.find({ userId }).sort({ createdAt: -1 }).lean();
  if (!mistakes.length) return [];

  const valid = mistakes.filter(m =>
    norm(m.original) && norm(m.corrected) && qualityGuards(m.original, m.corrected)
  );
  if (!valid.length) return [];

  const byKey = new Map();
  for (const m of valid) {
    const key = m.patternKey || makePatternKey(m);
    if (!key) continue;
    const arr = byKey.get(key) || [];
    arr.push(m);
    byKey.set(key, arr);
  }
  if (!byKey.size) return [];

  const groups = [...byKey.entries()]
    .map(([k,v]) => [k, v.sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt)) , scoreGroup(v)])
    .sort((A,B)=> B[2]-A[2]);

  const picked = [];
  const usedPrompts = new Set();

  outer:
  for (const [key, arr] of groups) {
    let taken = 0;
    for (const m of arr) {
      if (taken >= limitPerPattern) break;
      const original = norm(m.original);
      const corrected = norm(m.corrected);
      if (!qualityGuards(original, corrected)) continue;
      if (usedPrompts.has(original)) continue;

      const typeCycle = picked.length % 3;
      let q = null;
      if (typeCycle === 0) q = await buildMCQ(userId, m, key); // GPT 기반 보기
      else if (typeCycle === 1) q = buildCloze(userId, m, key);
      else q = buildRewrite(userId, m, key);

      picked.push(q);
      usedPrompts.add(original);
      taken++;
      if (picked.length >= total) break outer;
    }
  }

  if (!picked.length) return [];
  const created = await QuizItem.insertMany(picked);
  return created;
}

/* ── SRS 업데이트 ────────────────────────────────────────── */
async function updateSRS(itemId, grade /* 0~5 */) {
  const it = await QuizItem.findById(itemId);
  if (!it) return null;

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

function qualityGuards(original, corrected) {
  const o = norm(original), c = norm(corrected);
  if (!c || c.length < 3) return false;
  if (o.toLowerCase() === c.toLowerCase()) return false;

  // 문장성 가드: 원문이 3토큰 이상이면, 정답도 최소 3토큰
  const ot = o.split(/\s+/).filter(Boolean).length;
  const ct = c.split(/\s+/).filter(Boolean).length;
  if (ot >= 3 && ct < 3) return false;

  // 토큰 수가 너무 다르면 제외(±2 허용)
  if (Math.abs(ot - ct) > 2) return false;

  return true;
}

module.exports = { buildQuizFromMistakes, updateSRS };
