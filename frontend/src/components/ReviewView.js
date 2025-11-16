import React, { useState, useEffect } from 'react';
import * as api from "../api";

function ReviewView({ onBack }) {
  const [mistakeList, setMistakeList] = useState([]);
  const [showAnswer, setShowAnswer] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMistakes = async () => {
      setLoading(true);
      try {
        const data = await api.fetchMistakes();
        setMistakeList(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("복습 데이터 로딩 오류:", err);
      } finally {
        setLoading(false);
      }
    };
    loadMistakes();
  }, []);

  // Mistake 삭제를 처리하는 핸들러 함수
  const handleDeleteMistake = async (idToDelete) => {
    if (!window.confirm("이 복습 노트를 영구적으로 삭제할까요? 이 작업은 되돌릴 수 없습니다.")) {
        return;
    }
    try {
        await api.deleteMistake(idToDelete);
        setMistakeList(prevList => prevList.filter(item => item._id !== idToDelete));
    } catch (err) {
        console.error("복습 노트 삭제 실패:", err);
        alert("삭제에 실패했습니다. 다시 시도해주세요.");
    }
  };

  if (loading) {
    return <div className="loading-spinner"></div>;
  }

  return (
    <div className="review-view">
      <div className="view-header">
        <h3>틀린 표현 복습하기</h3>
        <button onClick={onBack} className="btn btn-secondary">대화로 돌아가기</button>
      </div>
      <div className="review-list">
        {mistakeList.length === 0 ? (
          <div className="empty-state">
            <p>저장된 틀린 표현이 없습니다.</p>
            <p className="muted">AI와 대화하며 나만의 복습 노트를 채워보세요!</p>
          </div>
        ) : (
          mistakeList.map((item, idx) => (
            <div key={item._id || idx} className="review-item">
              {/* 삭제(X) 버튼 */}
              <button
                className="item-delete-btn"
                title="이 노트 삭제"
                onClick={() => handleDeleteMistake(item._id)}
              >
                &times;
              </button>

              <p><strong>🤔 내가 쓴 문장:</strong> {item.original}</p>
              <div className="review-item-buttons">
                <button
                  className="btn btn-primary"
                  onClick={() => setShowAnswer(prev => ({ ...prev, [idx]: !prev[idx] }))}
          _message_init
                >
                  {showAnswer[idx] ? "숨기기" : "정답 및 해설 보기"}
                </button>
              </div>
              {showAnswer[idx] && (
                <div className="answer-box">
                  <p><strong>✅ 올바른 문장:</strong> {item.corrected}</p>
                  {item.explanation && <p><strong>💡 핵심 설명:</strong> {item.explanation}</p>}
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

