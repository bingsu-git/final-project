// ✨ [신규] RAG DB를 위한 Mongoose 모델입니다.
const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  text: { type: String, required: true }, // 원본 텍스트 조각
  embedding: { type: [Number], required: true }, // 1536차원의 벡터
  source: { type: String } // 출처 (예: '2024_IT_보고서.pdf')
});

// MongoDB Atlas에서 설정한 컬렉션 이름('documents')을 세 번째 인자로 전달합니다.
module.exports = mongoose.model('Document', documentSchema, 'documents');