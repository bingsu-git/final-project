import React, { useState, useEffect } from 'react';
import * as api from "../api";

// 문장 비교용 표준화: 문장부호 제거 + 소문자 + 공백 정리
const canon = (str) =>
  String(str || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, '') // 모든 문장부호 제거(.,!?;:"- 등)
    .replace(/\s+/g, ' ')
    .trim();

function ReviewView({ onBack }) {
  const [mistakeList, setMistakeList] = useState([]);
  const [guess, setGuess] = useState({});
  const [showAnswer, setShowAnswer] = useState({});

  useEffect(() => {
    const loadMistakes = async () => {
      try {
        const data = await api.fetchMistakes();
        setMistakeList(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("복습 데이터 로딩 오류:", err);
      }
    };
    loadMistakes();
  }, []);

  const handleCheckAnswer = (idx, item) => {
    const userGuess = guess[idx] || "";
    const isCorrect = canon(userGuess) === canon(item.corrected);
    alert(isCorrect ? "정답입니다!" : "틀렸습니다. 다시 시도해보세요.");
  };

  return (
    <div className="review-view">
      <div className="view-header">
        <h3>틀린 표현 복습하기</h3>
        <button onClick={onBack} className="btn btn-secondary">대화로 돌아가기</button>
      </div>

      <div className="review-list">
        {mistakeList.length === 0 ? (
          <p>저장된 틀린 표현이 없습니다.</p>
        ) : (
          mistakeList.map((item, idx) => (
            <div key={item._id || idx} className="review-item">
              <p><strong>🤔 틀린 문장:</strong> {item.original}</p>
              <input
                type="text"
                placeholder="올바르게 고쳐보세요 (쉼표/마침표는 생략해도 정답 처리됩니다)"
                value={guess[idx] || ""}
                onChange={(e) => setGuess(prev => ({ ...prev, [idx]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCheckAnswer(idx, item); }}
              />
              <div className="review-item-buttons">
                <button className="btn btn-primary" onClick={() => handleCheckAnswer(idx, item)}>정답 확인</button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowAnswer(prev => ({ ...prev, [idx]: !prev[idx] }))}
                >
                  {showAnswer[idx] ? "정답 숨기기" : "정답 보기"}
                </button>
              </div>

              {showAnswer[idx] && (
                <div className="answer-box">
                  <p><strong>✅ 정답:</strong> {item.corrected}</p>
                  {item.explanation && <p><strong>💡 이유:</strong> {item.explanation}</p>}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ReviewView;
