// ✨ [신규] RAG 로직을 처리하는 새로운 서비스 파일입니다.
const { createEmbedding, callOpenAI } = require("./gpt");
const Document = require("./models/Document"); // RAG DB 모델

/**
 * RAG (Retrieval-Augmented Generation)를 수행합니다.
 * 1. 사용자의 질문을 벡터로 변환합니다.
 * 2. MongoDB Vector Search를 사용해 관련 문서를 검색합니다.
 * 3. 검색된 문서를 컨텍스트로 삼아 AI에게 답변을 생성하도록 요청합니다.
 */
async function getRagResponse(message) {
  try {
    // 1. 질문을 벡터로 변환
    const queryVector = await createEmbedding(message);

    // 2. MongoDB Atlas Vector Search 실행
    // 'documents' 컬렉션에서 'embedding' 필드를 대상으로 벡터 검색
    const relevantDocuments = await Document.aggregate([
      {
        $vectorSearch: {
          index: "vector_index", // Atlas에서 설정한 Vector Search 인덱스 이름
          path: "embedding", // 벡터가 저장된 필드
          queryVector: queryVector,
          numCandidates: 100, // 검색 대상 후보 수
          limit: 3,           // 가장 관련성 높은 3개 문서만 선택
        },
      },
      {
        $project: {
          _id: 0,
          text: 1, // 텍스트 필드만 가져오기
          score: { $meta: "vectorSearchScore" }, // 유사도 점수
        },
      },
    ]);

    if (!relevantDocuments || relevantDocuments.length === 0) {
      return "죄송합니다. 관련 문서를 찾지 못했습니다.";
    }

    // 3. 검색된 문서를 컨텍스트로 조합
    const context = relevantDocuments
      .map(doc => doc.text)
      .join("\n\n---\n\n");
    
    console.log("[RAG Context] 유사도 점수:", relevantDocuments.map(d => d.score));

    // 4. 컨텍스트를 기반으로 AI에게 답변 생성 요청
    const systemPrompt = `
      당신은 법률 (또는 IT) 전문가입니다.
      제공되는 [컨텍스트] 문서를 기반으로만 사용자의 질문에 답변하세요.
      [컨텍스트]에 없는 내용은 절대로 추측하거나 외부 지식을 사용하지 마세요.
      답변은 한국어로, 전문가처럼 정확하게 하세요.

      [컨텍스트]
      ${context}
    `.trim();

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: message }
    ];

    const data = await callOpenAI({
      messages: messages,
      model: "gpt-4o-mini", // RAG에는 gpt-4o-mini 또는 gpt-4를 권장
      temperature: 0.1,  // 사실 기반 답변을 위해 온도를 낮춤
    });

    const reply = data?.choices?.[0]?.message?.content?.trim();
    return reply || "답변을 생성하는 데 실패했습니다.";

  } catch (err) {
    console.error("[RAG Service Error]", err.message);
    throw err;
  }
}

module.exports = { getRagResponse };