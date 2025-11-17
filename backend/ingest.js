// backend/ingest.js
const dotenv = require('dotenv');
dotenv.config();

const connectMongo = require('./mongo');
const Document = require('./models/Document');
const { createEmbedding } = require('./gpt');

// node-fetch 동적 import (프로젝트에서 쓰던 패턴 그대로)
const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

const LAW_OC = process.env.LAW_OC; // 국가법령정보 OPENAPI 에서 쓰는 OC (아이디)
const LAW_BASE = 'http://www.law.go.kr/DRF';

if (!LAW_OC) {
  console.error('❌ .env 에 LAW_OC=국가법령_아이디 를 먼저 설정하세요.');
  process.exit(1);
}

// 길면 여러 조각으로 자르기
function chunkText(text, chunkSize = 800) {
  const chunks = [];
  const clean = text.replace(/\s+/g, ' ').trim();

  for (let i = 0; i < clean.length; i += chunkSize) {
    const chunk = clean.slice(i, i + chunkSize).trim();
    if (chunk.length > 0) chunks.push(chunk);
  }
  return chunks;
}

async function searchLawByName(lawName) {
  const url = `${LAW_BASE}/lawSearch.do?OC=${encodeURIComponent(
    LAW_OC
  )}&target=law&type=JSON&query=${encodeURIComponent(lawName)}`;

  console.log(`\n=== [${lawName}] 검색 시작 ===`);
  console.log('요청 URL:', url);

  const res = await fetch(url);
  const raw = await res.text();

  if (!res.ok) {
    console.error('lawSearch 응답:', raw.slice(0, 200));
    throw new Error(`lawSearch 실패: ${res.status} ${res.statusText}`);
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    console.error('lawSearch JSON 파싱 실패, 일부 응답:', raw.slice(0, 200));
    throw e;
  }

  // ✅ 실제 응답 키 이름들 다 대응 (LawSearch, lawSearch, LAWSEARCH)
  const search = json.LawSearch || json.lawSearch || json.LAWSEARCH;
  if (!search) {
    console.warn('lawSearch 노드를 찾지 못함, 응답 일부:', raw.slice(0, 200));
    return null;
  }

  const total = Number(search.totalCnt || search.listTotalCnt || 0);
  if (!total) {
    console.warn(`검색 결과 없음: ${lawName} (totalCnt=${total})`);
    return null;
  }

  let list = search.law;
  if (!Array.isArray(list)) list = [list];

  const first = list[0];
  const lawId = first.법령ID || first.lawId || first.LAWID;

  if (!lawId) {
    console.warn('법령ID 를 찾지 못함, 항목:', first);
    return null;
  }

  console.log(`→ ${lawName} 의 법령ID:`, lawId);
  return lawId;
}

// 2) 법령ID 로 본문(JSON) 받아서 텍스트 추출
async function fetchLawTextById(lawId) {
  const url = `${LAW_BASE}/lawService.do?OC=${encodeURIComponent(
    LAW_OC
  )}&target=law&type=JSON&ID=${encodeURIComponent(lawId)}`;

  const res = await fetch(url);
  const raw = await res.text();

  if (!res.ok) {
    console.error('lawService 응답:', raw.slice(0, 200));
    throw new Error(`lawService 실패: ${res.status} ${res.statusText}`);
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    console.error('lawService JSON 파싱 실패, 일부 응답:', raw.slice(0, 200));
    throw e;
  }

  const 법령 = json.법령;
  if (!법령) {
    console.warn('법령 노드를 찾지 못함, 응답 일부:', raw.slice(0, 200));
    return null;
  }

  const 기본정보 = 법령.기본정보 || {};
  const 법령명 = 기본정보.법령명_한글 || 기본정보.법령명약칭 || '';

  // 조문 내용만 GPT 에 넣어도 충분하니까 조문단위의 "조문내용" 을 이어붙임
  const 조문단위 = 법령.조문?.조문단위 || [];
  const 조문배열 = Array.isArray(조문단위) ? 조문단위 : [조문단위];

  const 조문텍스트 = 조문배열
    .map((j) => (j.조문내용 || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');

  const fullText = `${법령명}\n\n${조문텍스트}`.trim();
  return { title: 법령명 || `법령ID ${lawId}`, text: fullText };
}

// 3) 전체 ingest 흐름
async function ingest() {
  await connectMongo();
  console.log('MongoDB 연결 성공.');

  console.log('기존 RAG 문서 삭제 중...');
  await Document.deleteMany({});

  // 여기에서 어떤 법령들을 쓸지 정의
  const lawNames = [
    '개인정보 보호법',
    '정보통신망 이용촉진 및 정보보호 등에 관한 법률',
    '전자상거래 등에서의 소비자보호에 관한 법률',
    '저작권법',
    '근로기준법',
    '클라우드컴퓨팅 발전 및 이용자 보호에 관한 법률',
    '소프트웨어 진흥법',
    '정보보호산업의 진흥에 관한 법률',
  ];

  const docsToInsert = [];

  for (const name of lawNames) {
    try {
      const lawId = await searchLawByName(name);
      if (!lawId) continue;

      const lawData = await fetchLawTextById(lawId);
      if (!lawData || !lawData.text) {
        console.warn(`본문을 불러오지 못함: ${name}`);
        continue;
      }

      const chunks = chunkText(lawData.text, 800);
      console.log(
        `→ '${name}' 에서 ${chunks.length}개 chunk 생성 (총 길이: ${lawData.text.length})`
      );

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await createEmbedding(chunk);

        docsToInsert.push({
          text: chunk,
          source: `${lawData.title} (chunk ${i + 1})`,
          embedding,
        });
      }
    } catch (e) {
      console.error(`❌ ${name} 처리 중 오류:`, e.message);
    }
  }

  console.log('벡터화된 문서를 DB에 저장 중...');
  if (docsToInsert.length > 0) {
    await Document.insertMany(docsToInsert);
  }

  console.log(
    `✅ 국가법령 API 기반 RAG 데이터 주입 완료! 총 ${docsToInsert.length}개 문서 저장.`
  );
  process.exit(0);
}

ingest().catch((err) => {
  console.error('데이터 주입 실패:', err);
  process.exit(1);
});
