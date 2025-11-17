// backend/lawApi.js
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const { parseStringPromise } = require('xml2js');

const BASE_URL = process.env.LAW_OPENAPI_BASE_URL || 'http://openlaw.klri.re.kr/openapi/elaw.do';
const OPENAPI_ID = process.env.LAW_OPENAPI_ID;

// 공통: URL 만들어 주는 헬퍼
function buildUrl(params) {
  const url = new URL(BASE_URL);
  url.searchParams.set('id', OPENAPI_ID);

  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  });

  return url.toString();
}

// 1) 법령명으로 검색해서 hseq 얻기 (type=1)
async function searchLawByName(keyword, { cnt = 5, page = 1 } = {}) {
  const url = buildUrl({
    key: keyword,
    type: 1,   // 법령명 검색
    cnt,
    page,
  });

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Law API search error ${res.status}: ${body.slice(0, 300)}`);
  }

  const xml = await res.text();
  const json = await parseStringPromise(xml, { explicitArray: false });

  // 실제 구조는 API 응답 XML을 한 번 찍어보고 조정해야 하지만,
  // 보통 이런 식으로 리스트가 내려온다.
  const items = json?.ELAW?.law || json?.ELAW?.list || [];
  const list = Array.isArray(items) ? items : [items];

  // hseq + 법령명 정도만 추려서 리턴
  return list
    .filter(Boolean)
    .map((it) => ({
      hseq: it.hseq,
      name: it.lawName || it.korNm || it.title,
    }));
}

// 2) hseq로 해당 법령 전체 본문 가져오기 (type=3)
async function getLawTextByHseq(hseq) {
  const url = buildUrl({
    type: 3,
    hseq,
  });

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Law API getLawText error ${res.status}: ${body.slice(0, 300)}`);
  }

  const xml = await res.text();
  const json = await parseStringPromise(xml, { explicitArray: false });

  // XML 구조에 맞게 조문 텍스트를 이어붙인다.
  // (실제 구조는 한번 콘솔로 찍어보고 맞춰야 한다.)
  const lawRoot = json?.ELAW?.law || json?.ELAW;
  if (!lawRoot) return '';

  // 예시: 조문 리스트가 article, section 같은 이름으로 들어있을 수 있다.
  const articles = lawRoot.articleList?.article || lawRoot.article || [];
  const list = Array.isArray(articles) ? articles : [articles];

  const pieces = [];
  for (const art of list) {
    if (art.articleTitle) pieces.push(art.articleTitle);
    if (art.articleContent) pieces.push(art.articleContent);
  }

  return pieces.join('\n');
}

module.exports = {
  searchLawByName,
  getLawTextByHseq,
};
