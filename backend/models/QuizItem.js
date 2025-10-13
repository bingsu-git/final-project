const { Schema, model } = require('mongoose');

/**
 * Mistake로부터 생성되는 사용자별 퀴즈 아이템
 * type: 'mcq' | 'cloze' | 'rewrite'
 */
const QuizItemSchema = new Schema({
  userId: { type: String, index: true, required: true },
  type: { type: String, enum: ['mcq','cloze','rewrite'], required: true },
  language: { type: String, default: 'en' },

  stem: { type: String, required: true },
  prompt: { type: String, required: true },
  options: [{ type: String }],
  correctIndex: { type: Number },
  answer: { type: String },

  sourceMistakeIds: [{ type: Schema.Types.ObjectId, ref: 'Mistake' }],
  patternKey: { type: String, index: true },
  explanation: { type: String },

  // 간단 SRS
  interval: { type: Number, default: 1 }, // 일
  ef: { type: Number, default: 2.5 },     // ease factor
  reps: { type: Number, default: 0 },     // 연속 정답 수
  dueAt: { type: Date, index: true, default: () => new Date() },

  used: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = model('QuizItem', QuizItemSchema);
